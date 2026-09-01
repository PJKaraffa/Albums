const SUPABASE_URL = 'https://relmecpdjifmlmeyubof.supabase.co';
const SUPABASE_ANON_KEY =
  'sb_publishable_6v7O6VP7oeT5hkxzeGGgGw_QZGWVmXA';

const db = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

const $ = id => document.getElementById(id);

let albums = [];
let profiles = [];
let currentUser = null;
let signUpMode = false;
let pendingCoverFile = null;

const conditions = [
  'Poor (P)',
  'Fair (F)',
  'Good (G)',
  'Good Plus (G+)',
  'Very Good (VG)',
  'Very Good Plus (VG+)',
  'Near Mint (NM)',
  'Mint (M)'
];

function toast(message, error = false) {
  const element = $('toast');

  element.textContent = message;
  element.className = `toast show${error ? ' error' : ''}`;

  setTimeout(() => {
    element.className = 'toast';
  }, 3000);
}

function money(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2
  }).format(Number(value) || 0);
}

function safe(value = '') {
  return String(value).replace(
    /[&<>'"]/g,
    character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    })[character]
  );
}

async function start() {
  const {
    data: { session }
  } = await db.auth.getSession();

  await updateSession(session);

  db.auth.onAuthStateChange((_event, newSession) => {
    updateSession(newSession);
  });
}

async function updateSession(session) {
  $('authView').classList.toggle('hidden', Boolean(session));
  $('appView').classList.toggle('hidden', !session);

  if (!session) {
    currentUser = null;
    return;
  }

  currentUser = session.user;

  await ensureProfile(session.user);

  const name = creatorName(session.user.id);

  $('userEmail').textContent = name;
  $('avatar').textContent = name.charAt(0).toUpperCase();

  await loadAlbums();
}

$('authForm').addEventListener('submit', async event => {
  event.preventDefault();

  const credentials = {
    email: $('email').value,
    password: $('password').value
  };

  if (signUpMode) {
    credentials.options = {
      data: {
        username: $('username').value.trim()
      }
    };
  }

  const result = signUpMode
    ? await db.auth.signUp(credentials)
    : await db.auth.signInWithPassword(credentials);

  if (result.error) {
    toast(result.error.message, true);
    return;
  }

  if (signUpMode) {
    toast(
      'Account created. Check your email if confirmation is enabled.'
    );
  }
});

$('toggleAuth').onclick = () => {
  signUpMode = !signUpMode;

  $('usernameField').classList.toggle(
    'hidden',
    !signUpMode
  );

  $('username').required = signUpMode;

  $('authTitle').textContent = signUpMode
    ? 'Create your account'
    : 'Welcome back';

  $('authCopy').textContent = signUpMode
    ? 'Join the Karaffa family collection.'
    : 'Sign in to open the Karaffa Vault.';

  $('authSubmit').textContent = signUpMode
    ? 'Create account'
    : 'Sign in';

  $('toggleAuth').textContent = signUpMode
    ? 'Already have an account? Sign in'
    : 'New here? Create an account';
};

$('signOut').onclick = () => db.auth.signOut();

async function ensureProfile(user) {
  const username =
    user.user_metadata?.username ||
    user.email.split('@')[0];

  await db
    .from('profiles')
    .upsert(
      {
        id: user.id,
        username
      },
      {
        onConflict: 'id'
      }
    );

  const { data } = await db
    .from('profiles')
    .select('*');

  profiles = data || [];
}

function creatorName(userId) {
  return (
    profiles.find(profile => profile.id === userId)
      ?.username || 'Unknown'
  );
}

async function loadAlbums() {
  const [albumResult, profileResult] =
    await Promise.all([
      db
        .from('albums')
        .select('*')
        .order('artist'),

      db
        .from('profiles')
        .select('*')
    ]);

  if (albumResult.error) {
    toast(albumResult.error.message, true);
    return;
  }

  albums = albumResult.data || [];
  profiles = profileResult.data || profiles;

  populateGenres();
  populateCollectors();
  render();
}

function populateGenres() {
  const current = $('genreFilter').value;

  const genres = [
    ...new Set(
      albums
        .map(album => album.genre)
        .filter(Boolean)
    )
  ].sort();

  $('genreFilter').innerHTML =
    '<option value="">All genres</option>' +
    genres
      .map(genre => `<option>${safe(genre)}</option>`)
      .join('');

  $('genreFilter').value = current;
}

function populateCollectors() {
  const current = $('collectorFilter').value;

  const collectors = [
    ...new Set(
      albums.map(album => creatorName(album.user_id))
    )
  ].sort();

  $('collectorFilter').innerHTML =
    '<option value="">All collectors</option>' +
    collectors
      .map(name => `<option>${safe(name)}</option>`)
      .join('');

  $('collectorFilter').value = current;
}

function filteredAlbums() {
  const query = $('search')
    .value
    .trim()
    .toLowerCase();

  const genre = $('genreFilter').value;
  const condition = $('conditionFilter').value;
  const collector = $('collectorFilter').value;

  const filtered = albums.filter(album => {
    const searchableFields = [
      album.artist,
      album.title,
      album.record_label,
      album.catalog_number,
      album.notes,
      creatorName(album.user_id)
    ];

    const matchesQuery =
      !query ||
      searchableFields.some(value =>
        String(value || '')
          .toLowerCase()
          .includes(query)
      );

    const matchesGenre =
      !genre || album.genre === genre;

    const matchesCondition =
      !condition ||
      album.vinyl_condition === condition;

    const matchesCollector =
      !collector ||
      creatorName(album.user_id) === collector;

    return (
      matchesQuery &&
      matchesGenre &&
      matchesCondition &&
      matchesCollector
    );
  });

  const sort = $('sort').value;

  return filtered.sort((first, second) => {
    if (sort === 'title') {
      return first.title.localeCompare(second.title);
    }

    if (sort === 'year_desc') {
      return (
        (second.release_year || 0) -
        (first.release_year || 0)
      );
    }

    if (sort === 'value_desc') {
      return (
        (second.estimated_value || 0) -
        (first.estimated_value || 0)
      );
    }

    if (sort === 'created_desc') {
      return (
        new Date(second.created_at) -
        new Date(first.created_at)
      );
    }

    return first.artist.localeCompare(second.artist);
  });
}

function render() {
  const list = filteredAlbums();

  const totalValue = albums.reduce(
    (total, album) =>
      total + Number(album.estimated_value || 0),
    0
  );

  const grades = albums
    .map(album =>
      conditions.indexOf(album.vinyl_condition)
    )
    .filter(index => index >= 0);

  $('albumCount').textContent = albums.length;
  $('totalValue').textContent = money(totalValue);

  $('genreCount').textContent = new Set(
    albums
      .map(album => album.genre)
      .filter(Boolean)
  ).size;

  if (grades.length) {
    const average =
      grades.reduce(
        (total, grade) => total + grade,
        0
      ) / grades.length;

    const averageCondition =
      conditions[Math.round(average)];

    $('avgCondition').textContent =
      averageCondition.match(/\((.*?)\)/)?.[1] ||
      '—';
  } else {
    $('avgCondition').textContent = '—';
  }

  $('emptyState').classList.toggle(
    'hidden',
    list.length > 0
  );

  $('albumGrid').innerHTML = list
    .map(album => {
      const condition =
        (album.vinyl_condition || '')
          .match(/\((.*?)\)/)?.[1] || '—';

      const ownerControls =
        album.user_id === currentUser?.id
          ? `
            <button
              onclick="editAlbum('${album.id}')"
              title="Edit"
            >
              ✎
            </button>

            <button
              class="delete"
              onclick="deleteAlbum('${album.id}')"
              title="Delete"
            >
              ⌫
            </button>
          `
          : '';

      const cover = album.cover_url
        ? `
          <img
            src="${safe(album.cover_url)}"
            alt="Cover of ${safe(album.title)}"
            loading="lazy"
            onerror="
              this.replaceWith(
                Object.assign(
                  document.createElement('div'),
                  { className: 'cover-placeholder' }
                )
              )
            "
          >
        `
        : '<div class="cover-placeholder"></div>';

      return `
        <article class="album-card">
          <div class="cover">
            ${cover}
          </div>

          <div class="card-body">
            <h3 title="${safe(album.title)}">
              ${safe(album.title)}
            </h3>

            <p class="artist">
              ${safe(album.artist)}
              ${
                album.release_year
                  ? ` · ${album.release_year}`
                  : ''
              }
            </p>

            <div class="tags">
              ${
                album.genre
                  ? `<span class="tag">${safe(album.genre)}</span>`
                  : ''
              }

              <span class="tag">
                ${safe(album.format || 'LP')}
              </span>

              <span class="tag">
                ${safe(condition)}
              </span>
            </div>

            <p class="entered-by">
              Entered by
              <strong>
                ${safe(creatorName(album.user_id))}
              </strong>
            </p>

            <div class="card-meta">
              <span class="value">
                ${money(album.estimated_value)}
              </span>

              <div class="card-actions">
                ${ownerControls}
              </div>
            </div>
          </div>
        </article>
      `;
    })
    .join('');
}

[
  'search',
  'genreFilter',
  'conditionFilter',
  'collectorFilter',
  'sort'
].forEach(id => {
  $(id).addEventListener(
    id === 'search' ? 'input' : 'change',
    render
  );
});

function showCoverPreview(source = '') {
  const image = $('coverPreview');

  image.classList.toggle('hidden', !source);
  $('coverPrompt').classList.toggle(
    'hidden',
    Boolean(source)
  );

  if (source) {
    image.src = source;
  } else {
    image.removeAttribute('src');
  }
}

function selectCover(file) {
  if (!file) {
    return;
  }

  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/webp'
  ];

  if (!allowedTypes.includes(file.type)) {
    toast(
      'Please choose a PNG, JPG, or WEBP image.',
      true
    );
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    toast(
      'Cover images must be 5 MB or smaller.',
      true
    );
    return;
  }

  pendingCoverFile = file;
  $('coverUrl').value = '';

  showCoverPreview(
    URL.createObjectURL(file)
  );
}

async function uploadCover(userId) {
  if (!pendingCoverFile) {
    return $('coverUrl').value.trim() || null;
  }

  const originalExtension =
    pendingCoverFile.name.split('.').pop();

  const extension = (
    originalExtension ||
    pendingCoverFile.type.split('/')[1] ||
    'jpg'
  ).replace(/[^a-z0-9]/gi, '');

  const path =
    `${userId}/${crypto.randomUUID()}.${extension}`;

  const { error } = await db.storage
    .from('album-covers')
    .upload(
      path,
      pendingCoverFile,
      {
        contentType: pendingCoverFile.type,
        upsert: false
      }
    );

  if (error) {
    throw error;
  }

  const { data } = db.storage
    .from('album-covers')
    .getPublicUrl(path);

  return data.publicUrl;
}

function openDialog(album = {}) {
  $('albumForm').reset();

  pendingCoverFile = null;

  $('albumId').value = album.id || '';

  $('dialogTitle').textContent =
    album.id
      ? 'Edit album'
      : 'Add an album';

  $('enteredBy').innerHTML = profiles
    .slice()
    .sort((first, second) =>
      first.username.localeCompare(
        second.username
      )
    )
    .map(
      profile =>
        `<option value="${profile.id}">
          ${safe(profile.username)}
        </option>`
    )
    .join('');

  $('enteredBy').value =
    album.user_id || currentUser.id;

  const fieldMap = {
    artist: 'artist',
    title: 'title',
    releaseYear: 'release_year',
    genre: 'genre',
    format: 'format',
    vinylCondition: 'vinyl_condition',
    sleeveCondition: 'sleeve_condition',
    recordLabel: 'record_label',
    catalogNumber: 'catalog_number',
    country: 'country',
    purchasePrice: 'purchase_price',
    estimatedValue: 'estimated_value',
    acquiredDate: 'acquired_date',
    location: 'location',
    coverUrl: 'cover_url',
    notes: 'notes'
  };

  Object.entries(fieldMap).forEach(
    ([elementId, databaseField]) => {
      if (album[databaseField] != null) {
        $(elementId).value =
          album[databaseField];
      }
    }
  );

  showCoverPreview(album.cover_url || '');

  $('albumDialog').showModal();
}

window.editAlbum = id => {
  openDialog(
    albums.find(album => album.id === id)
  );
};

window.deleteAlbum = async id => {
  const confirmed = confirm(
    'Remove this album from the collection?'
  );

  if (!confirmed) {
    return;
  }

  const { error } = await db
    .from('albums')
    .delete()
    .eq('id', id);

  if (error) {
    toast(error.message, true);
    return;
  }

  toast('Album removed');

  await loadAlbums();
};

[
  $('addBtn'),
  $('addNav'),
  ...document.querySelectorAll('.add-trigger')
].forEach(button => {
  button.onclick = () => openDialog();
});

$('closeDialog').onclick = () =>
  $('albumDialog').close();

$('cancelBtn').onclick = () =>
  $('albumDialog').close();

$('chooseCover').onclick = () =>
  $('coverFile').click();

$('coverDropZone').onclick = event => {
  if (
    event.target.id === 'coverDropZone' ||
    event.target.id === 'coverPrompt'
  ) {
    $('coverFile').click();
  }
};

$('coverFile').onchange = event => {
  selectCover(event.target.files[0]);
};

[
  'dragenter',
  'dragover'
].forEach(eventType => {
  $('coverDropZone').addEventListener(
    eventType,
    event => {
      event.preventDefault();

      $('coverDropZone').classList.add(
        'dragging'
      );
    }
  );
});

[
  'dragleave',
  'drop'
].forEach(eventType => {
  $('coverDropZone').addEventListener(
    eventType,
    event => {
      event.preventDefault();

      $('coverDropZone').classList.remove(
        'dragging'
      );

      if (eventType === 'drop') {
        selectCover(
          event.dataTransfer.files[0]
        );
      }
    }
  );
});

document.addEventListener('paste', event => {
  if (!$('albumDialog').open) {
    return;
  }

  const imageItem = [
    ...event.clipboardData.items
  ].find(item =>
    item.type.startsWith('image/')
  );

  const file = imageItem?.getAsFile();

  if (file) {
    event.preventDefault();
    selectCover(file);
  }
});

$('coverUrl').addEventListener(
  'change',
  () => {
    pendingCoverFile = null;

    showCoverPreview(
      $('coverUrl').value.trim()
    );
  }
);

$('removeCover').onclick = () => {
  pendingCoverFile = null;
  $('coverUrl').value = '';

  showCoverPreview('');
};

$('albumForm').addEventListener(
  'submit',
  async event => {
    event.preventDefault();

    const {
      data: { user }
    } = await db.auth.getUser();

    const albumId = $('albumId').value;

    let coverUrl;

    try {
      coverUrl = await uploadCover(user.id);
    } catch (error) {
      toast(
        `Cover upload failed: ${error.message}`,
        true
      );
      return;
    }

    const album = {
      user_id: albumId
        ? $('enteredBy').value
        : user.id,

      artist: $('artist').value.trim(),
      title: $('title').value.trim(),

      release_year:
        $('releaseYear').value || null,

      genre:
        $('genre').value.trim() || null,

      format: $('format').value,

      vinyl_condition:
        $('vinylCondition').value,

      sleeve_condition:
        $('sleeveCondition').value,

      record_label:
        $('recordLabel').value.trim() ||
        null,

      catalog_number:
        $('catalogNumber').value.trim() ||
        null,

      country:
        $('country').value.trim() || null,

      purchase_price:
        $('purchasePrice').value || null,

      estimated_value:
        $('estimatedValue').value || null,

      acquired_date:
        $('acquiredDate').value || null,

      location:
        $('location').value.trim() || null,

      cover_url: coverUrl,

      notes:
        $('notes').value.trim() || null
    };

    const result = albumId
      ? await db
          .from('albums')
          .update(album)
          .eq('id', albumId)
      : await db
          .from('albums')
          .insert(album);

    if (result.error) {
      toast(result.error.message, true);
      return;
    }

    $('albumDialog').close();

    toast(
      albumId
        ? 'Album updated'
        : 'Album added'
    );

    await loadAlbums();
  }
);

$('exportBtn').onclick = () => {
  const headers = [
    'Artist',
    'Album',
    'Year',
    'Genre',
    'Format',
    'Vinyl Condition',
    'Sleeve Condition',
    'Label',
    'Catalog Number',
    'Country',
    'Purchase Price',
    'Estimated Value',
    'Acquired Date',
    'Location',
    'Entered By',
    'Notes'
  ];

  const rows = filteredAlbums().map(
    album => [
      album.artist,
      album.title,
      album.release_year,
      album.genre,
      album.format,
      album.vinyl_condition,
      album.sleeve_condition,
      album.record_label,
      album.catalog_number,
      album.country,
      album.purchase_price,
      album.estimated_value,
      album.acquired_date,
      album.location,
      creatorName(album.user_id),
      album.notes
    ]
  );

  const csv = [
    headers,
    ...rows
  ]
    .map(row =>
      row
        .map(value =>
          `"${String(value ?? '')
            .replaceAll('"', '""')}"`
        )
        .join(',')
    )
    .join('\n');

  const url = URL.createObjectURL(
    new Blob(
      [csv],
      { type: 'text/csv' }
    )
  );

  const link = document.createElement('a');

  link.href = url;
  link.download = 'karaffa-vault.csv';
  link.click();

  URL.revokeObjectURL(url);
};

start();
