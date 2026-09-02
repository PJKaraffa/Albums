const SUPABASE_URL =
  'https://relmecpdjifmlmeyubof.supabase.co';

const SUPABASE_ANON_KEY =
  'sb_publishable_6v7O6VP7oeT5hkxzeGGgGw_QZGWVmXA';

const db = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

const $ = id =>
  document.getElementById(id);

let albums = [];
let profiles = [];
let currentUser = null;
let signUpMode = false;
let pendingCoverFile = null;
let temporaryCoverUrl = null;

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

/* GENERAL HELPERS */

function toast(message, isError = false) {
  const element = $('toast');

  element.textContent = message;

  element.className = isError
    ? 'toast show error'
    : 'toast show';

  setTimeout(() => {
    element.className = 'toast';
  }, 3000);
}

function money(value) {
  return new Intl.NumberFormat(
    'en-US',
    {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2
    }
  ).format(Number(value) || 0);
}

function safe(value = '') {
  const replacements = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  };

  return String(value).replace(
    /[&<>'"]/g,
    character =>
      replacements[character]
  );
}

function creatorName(userId) {
  const profile = profiles.find(
    item => item.id === userId
  );

  return profile?.username || 'Unknown';
}

/* AUTHENTICATION */

async function start() {
  const {
    data: { session },
    error
  } = await db.auth.getSession();

  if (error) {
    toast(error.message, true);
    return;
  }

  await updateSession(session);

  db.auth.onAuthStateChange(
    (_event, newSession) => {
      setTimeout(() => {
        updateSession(newSession);
      }, 0);
    }
  );
}

async function updateSession(session) {
  const signedIn = Boolean(session);

  $('authView').classList.toggle(
    'hidden',
    signedIn
  );

  $('appView').classList.toggle(
    'hidden',
    !signedIn
  );

  if (!signedIn) {
    currentUser = null;
    albums = [];
    profiles = [];
    return;
  }

  currentUser = session.user;

  await ensureProfile(currentUser);
  await loadAlbums();

  const displayName =
    creatorName(currentUser.id);

  $('userEmail').textContent =
    displayName;

  $('avatar').textContent =
    displayName
      .charAt(0)
      .toUpperCase();
}

$('authForm').addEventListener(
  'submit',
  async event => {
    event.preventDefault();

    const email =
      $('email').value.trim();

    const password =
      $('password').value;

    if (signUpMode) {
      const username =
        $('username').value.trim();

      if (!username) {
        toast(
          'Please enter a username.',
          true
        );

        return;
      }

      const { error } =
        await db.auth.signUp({
          email,
          password,
          options: {
            data: { username }
          }
        });

      if (error) {
        toast(error.message, true);
        return;
      }

      toast(
        'Account created. Check your email if confirmation is enabled.'
      );

      return;
    }

    const { error } =
      await db.auth
        .signInWithPassword({
          email,
          password
        });

    if (error) {
      toast(error.message, true);
    }
  }
);

$('toggleAuth').addEventListener(
  'click',
  () => {
    signUpMode = !signUpMode;

    $('usernameField')
      .classList.toggle(
        'hidden',
        !signUpMode
      );

    $('username').required =
      signUpMode;

    $('authTitle').textContent =
      signUpMode
        ? 'Create your account'
        : 'Welcome back';

    $('authCopy').textContent =
      signUpMode
        ? 'Join the Karaffa family collection.'
        : 'Sign in to open the Karaffa Vault.';

    $('authSubmit').textContent =
      signUpMode
        ? 'Create account'
        : 'Sign in';

    $('toggleAuth').textContent =
      signUpMode
        ? 'Already have an account? Sign in'
        : 'New here? Create an account';
  }
);

$('signOut').addEventListener(
  'click',
  async () => {
    const { error } =
      await db.auth.signOut();

    if (error) {
      toast(error.message, true);
    }
  }
);

/* PROFILES */

async function ensureProfile(user) {
  const {
    data: existingProfile,
    error: selectError
  } = await db
    .from('profiles')
    .select('id, username')
    .eq('id', user.id)
    .maybeSingle();

  if (selectError) {
    toast(selectError.message, true);
    return;
  }

  if (existingProfile) {
    return;
  }

  const username =
    user.user_metadata?.username ||
    user.email.split('@')[0];

  const { error: insertError } =
    await db
      .from('profiles')
      .insert({
        id: user.id,
        username
      });

  if (insertError) {
    toast(insertError.message, true);
  }
}

/* LOAD DATA */

async function loadAlbums() {
  const [
    albumResult,
    profileResult
  ] = await Promise.all([
    db
      .from('albums')
      .select('*')
      .order('artist'),

    db
      .from('profiles')
      .select('id, username')
      .order('username')
  ]);

  if (albumResult.error) {
    toast(
      albumResult.error.message,
      true
    );

    return;
  }

  if (profileResult.error) {
    toast(
      profileResult.error.message,
      true
    );

    return;
  }

  albums = albumResult.data || [];
  profiles = profileResult.data || [];

  populateGenres();
  populateCollectors();
  render();
}

/* BUILD FILTER OPTIONS */

function populateGenres() {
  const previousValue =
    $('genreFilter').value;

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
      .map(genre => {
        return `
          <option value="${safe(genre)}">
            ${safe(genre)}
          </option>
        `;
      })
      .join('');

  if (genres.includes(previousValue)) {
    $('genreFilter').value =
      previousValue;
  }
}

function populateCollectors() {
  const previousValue =
    $('collectorFilter').value;

  const collectors = [
    ...new Set(
      albums.map(album =>
        creatorName(album.user_id)
      )
    )
  ].sort();

  $('collectorFilter').innerHTML =
    '<option value="">All collectors</option>' +
    collectors
      .map(name => {
        return `
          <option value="${safe(name)}">
            ${safe(name)}
          </option>
        `;
      })
      .join('');

  if (
    collectors.includes(previousValue)
  ) {
    $('collectorFilter').value =
      previousValue;
  }
}

/* FILTER DATA */

function filteredAlbums() {
  const query =
    $('search')
      .value
      .trim()
      .toLowerCase();

  const selectedGenre =
    $('genreFilter').value;

  const selectedCondition =
    $('conditionFilter').value;

  const selectedCollector =
    $('collectorFilter').value;

  const selectedSort =
    $('sort').value;

  const filtered = albums.filter(
    album => {
      const collector =
        creatorName(album.user_id);

      const searchableValues = [
        album.artist,
        album.title,
        album.record_label,
        album.catalog_number,
        album.country,
        album.genre,
        album.notes,
        collector
      ];

      const matchesSearch =
        !query ||
        searchableValues.some(value =>
          String(value || '')
            .toLowerCase()
            .includes(query)
        );

      const matchesGenre =
        !selectedGenre ||
        album.genre === selectedGenre;

      const matchesCondition =
        !selectedCondition ||
        album.vinyl_condition ===
          selectedCondition;

      const matchesCollector =
        !selectedCollector ||
        collector === selectedCollector;

      return (
        matchesSearch &&
        matchesGenre &&
        matchesCondition &&
        matchesCollector
      );
    }
  );

  return filtered.sort(
    (first, second) => {
      if (selectedSort === 'title') {
        return String(first.title)
          .localeCompare(
            String(second.title)
          );
      }

      if (
        selectedSort === 'year_desc'
      ) {
        return (
          Number(
            second.release_year || 0
          ) -
          Number(
            first.release_year || 0
          )
        );
      }

      if (
        selectedSort === 'value_desc'
      ) {
        return (
          Number(
            second.estimated_value || 0
          ) -
          Number(
            first.estimated_value || 0
          )
        );
      }

      if (
        selectedSort === 'created_desc'
      ) {
        return (
          new Date(second.created_at) -
          new Date(first.created_at)
        );
      }

      return String(first.artist)
        .localeCompare(
          String(second.artist)
        );
    }
  );
}

/* DISPLAY DATA */

function render() {
  const visibleAlbums =
    filteredAlbums();

  const totalEstimatedValue =
    visibleAlbums.reduce(
      (total, album) => {
        return (
          total +
          Number(
            album.estimated_value || 0
          )
        );
      },
      0
    );

  const genreCount =
    new Set(
      visibleAlbums
        .map(album => album.genre)
        .filter(Boolean)
    ).size;

  const gradeNumbers =
    visibleAlbums
      .map(album => {
        return conditions.indexOf(
          album.vinyl_condition
        );
      })
      .filter(index => index >= 0);

  $('albumCount').textContent =
    visibleAlbums.length;

  $('totalValue').textContent =
    money(totalEstimatedValue);

  $('genreCount').textContent =
    genreCount;

  if (gradeNumbers.length) {
    const gradeTotal =
      gradeNumbers.reduce(
        (total, grade) =>
          total + grade,
        0
      );

    const average =
      gradeTotal /
      gradeNumbers.length;

    const conditionName =
      conditions[
        Math.round(average)
      ];

    const abbreviation =
      conditionName.match(
        /\((.*?)\)/
      );

    $('avgCondition').textContent =
      abbreviation
        ? abbreviation[1]
        : '—';
  } else {
    $('avgCondition').textContent =
      '—';
  }

  $('emptyState').classList.toggle(
    'hidden',
    visibleAlbums.length > 0
  );

  $('albumGrid').innerHTML =
    visibleAlbums
      .map(buildAlbumCard)
      .join('');
}

function buildAlbumCard(album) {
  const conditionMatch =
    String(
      album.vinyl_condition || ''
    ).match(/\((.*?)\)/);

  const shortCondition =
    conditionMatch
      ? conditionMatch[1]
      : '—';

  const cover =
    album.cover_url
      ? `
        <img
          src="${safe(album.cover_url)}"
          alt="Cover of ${safe(album.title)}"
          loading="lazy"
          onerror="
            this.replaceWith(
              Object.assign(
                document.createElement('div'),
                {
                  className:
                    'cover-placeholder'
                }
              )
            )
          "
        >
      `
      : `
        <div
          class="cover-placeholder"
        ></div>
      `;

  const controls =
    album.user_id === currentUser?.id
      ? `
        <button
          type="button"
          onclick="editAlbum('${album.id}')"
          title="Edit album"
        >
          ✎
        </button>

        <button
          type="button"
          class="delete"
          onclick="deleteAlbum('${album.id}')"
          title="Delete album"
        >
          ⌫
        </button>
      `
      : '';

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
              ? `
                <span class="tag">
                  ${safe(album.genre)}
                </span>
              `
              : ''
          }

          <span class="tag">
            ${safe(
              album.format || 'LP'
            )}
          </span>

          <span class="tag">
            ${safe(shortCondition)}
          </span>
        </div>

        <p class="entered-by">
          Entered by
          <strong>
            ${safe(
              creatorName(
                album.user_id
              )
            )}
          </strong>
        </p>

        <div class="card-meta">
          <span class="value">
            ${money(
              album.estimated_value
            )}
          </span>

          <div class="card-actions">
            ${controls}
          </div>
        </div>
      </div>
    </article>
  `;
}

/* IMMEDIATE FILTER EVENTS */

$('search').addEventListener(
  'input',
  render
);

[
  'genreFilter',
  'conditionFilter',
  'collectorFilter',
  'sort'
].forEach(id => {
  const control = $(id);

  /*
    The input event responds as soon as
    an option is selected.
  */
  control.addEventListener(
    'input',
    render
  );

  /*
    Change is retained as a fallback.
  */
  control.addEventListener(
    'change',
    render
  );

  /*
    Also responds when the control is
    clicked and its value has changed.
  */
  control.addEventListener(
    'click',
    () => {
      requestAnimationFrame(render);
    }
  );
});

/* COVER IMAGE */

function clearTemporaryCoverUrl() {
  if (temporaryCoverUrl) {
    URL.revokeObjectURL(
      temporaryCoverUrl
    );

    temporaryCoverUrl = null;
  }
}

function showCoverPreview(source = '') {
  const image =
    $('coverPreview');

  image.classList.toggle(
    'hidden',
    !source
  );

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

  const permittedTypes = [
    'image/jpeg',
    'image/png',
    'image/webp'
  ];

  if (
    !permittedTypes.includes(file.type)
  ) {
    toast(
      'Choose a JPG, PNG, or WEBP image.',
      true
    );

    return;
  }

  if (
    file.size >
    5 * 1024 * 1024
  ) {
    toast(
      'Cover images must be 5 MB or smaller.',
      true
    );

    return;
  }

  clearTemporaryCoverUrl();

  pendingCoverFile = file;
  $('coverUrl').value = '';

  temporaryCoverUrl =
    URL.createObjectURL(file);

  showCoverPreview(
    temporaryCoverUrl
  );
}

async function uploadCover(userId) {
  if (!pendingCoverFile) {
    return (
      $('coverUrl').value.trim() ||
      null
    );
  }

  const fileExtension =
    (
      pendingCoverFile.name
        .split('.')
        .pop() ||
      pendingCoverFile.type
        .split('/')
        .pop() ||
      'jpg'
    )
      .toLowerCase()
      .replace(
        /[^a-z0-9]/g,
        ''
      );

  const storagePath =
    `${userId}/` +
    `${crypto.randomUUID()}.` +
    fileExtension;

  const { error } =
    await db.storage
      .from('album-covers')
      .upload(
        storagePath,
        pendingCoverFile,
        {
          contentType:
            pendingCoverFile.type,

          cacheControl: '3600',
          upsert: false
        }
      );

  if (error) {
    throw error;
  }

  const { data } =
    db.storage
      .from('album-covers')
      .getPublicUrl(storagePath);

  return data.publicUrl;
}

$('chooseCover').addEventListener(
  'click',
  event => {
    event.stopPropagation();
    $('coverFile').click();
  }
);

$('coverFile').addEventListener(
  'change',
  event => {
    selectCover(
      event.target.files?.[0]
    );
  }
);

$('coverDropZone').addEventListener(
  'click',
  event => {
    if (
      !event.target.closest(
        '#chooseCover'
      )
    ) {
      $('coverFile').click();
    }
  }
);

[
  'dragenter',
  'dragover'
].forEach(eventName => {
  $('coverDropZone')
    .addEventListener(
      eventName,
      event => {
        event.preventDefault();

        $('coverDropZone')
          .classList.add(
            'dragging'
          );
      }
    );
});

[
  'dragleave',
  'drop'
].forEach(eventName => {
  $('coverDropZone')
    .addEventListener(
      eventName,
      event => {
        event.preventDefault();

        $('coverDropZone')
          .classList.remove(
            'dragging'
          );

        if (
          eventName === 'drop'
        ) {
          selectCover(
            event.dataTransfer
              .files?.[0]
          );
        }
      }
    );
});

document.addEventListener(
  'paste',
  event => {
    if (!$('albumDialog').open) {
      return;
    }

    const items =
      Array.from(
        event.clipboardData?.items ||
        []
      );

    const imageItem =
      items.find(item =>
        item.type.startsWith(
          'image/'
        )
      );

    const imageFile =
      imageItem?.getAsFile();

    if (imageFile) {
      event.preventDefault();
      selectCover(imageFile);
    }
  }
);

$('coverUrl').addEventListener(
  'change',
  () => {
    clearTemporaryCoverUrl();
    pendingCoverFile = null;

    showCoverPreview(
      $('coverUrl')
        .value
        .trim()
    );
  }
);

$('removeCover').addEventListener(
  'click',
  () => {
    clearTemporaryCoverUrl();

    pendingCoverFile = null;

    $('coverFile').value = '';
    $('coverUrl').value = '';

    showCoverPreview('');
  }
);

/* ADD AND EDIT WINDOW */

function openDialog(album = {}) {
  $('albumForm').reset();

  clearTemporaryCoverUrl();

  pendingCoverFile = null;
  $('coverFile').value = '';

  $('albumId').value =
    album.id || '';

  $('dialogTitle').textContent =
    album.id
      ? 'Edit album'
      : 'Add an album';

  $('enteredBy').innerHTML =
    profiles
      .slice()
      .sort((first, second) =>
        first.username.localeCompare(
          second.username
        )
      )
      .map(profile => {
        return `
          <option value="${profile.id}">
            ${safe(profile.username)}
          </option>
        `;
      })
      .join('');

  $('enteredBy').value =
    album.user_id ||
    currentUser.id;

  const fields = {
    artist: 'artist',
    title: 'title',
    releaseYear: 'release_year',
    genre: 'genre',
    format: 'format',
    vinylCondition:
      'vinyl_condition',
    sleeveCondition:
      'sleeve_condition',
    recordLabel: 'record_label',
    catalogNumber:
      'catalog_number',
    country: 'country',
    purchasePrice:
      'purchase_price',
    estimatedValue:
      'estimated_value',
    acquiredDate:
      'acquired_date',
    location: 'location',
    coverUrl: 'cover_url',
    notes: 'notes'
  };

  Object.entries(fields).forEach(
    ([elementId, fieldName]) => {
      const value =
        album[fieldName];

      if (
        value !== null &&
        value !== undefined
      ) {
        $(elementId).value =
          value;
      }
    }
  );

  showCoverPreview(
    album.cover_url || ''
  );

  $('albumDialog').showModal();
}

[
  $('addBtn'),
  $('addNav'),
  ...document.querySelectorAll(
    '.add-trigger'
  )
].forEach(button => {
  button.addEventListener(
    'click',
    () => openDialog()
  );
});

$('closeDialog').addEventListener(
  'click',
  () => {
    clearTemporaryCoverUrl();
    $('albumDialog').close();
  }
);

$('cancelBtn').addEventListener(
  'click',
  () => {
    clearTemporaryCoverUrl();
    $('albumDialog').close();
  }
);

window.editAlbum = albumId => {
  const album = albums.find(
    item => item.id === albumId
  );

  if (!album) {
    toast(
      'Album could not be found.',
      true
    );

    return;
  }

  openDialog(album);
};

window.deleteAlbum =
  async albumId => {
    const confirmed =
      confirm(
        'Remove this album from the collection?'
      );

    if (!confirmed) {
      return;
    }

    const { error } =
      await db
        .from('albums')
        .delete()
        .eq('id', albumId);

    if (error) {
      toast(error.message, true);
      return;
    }

    toast('Album removed');

    await loadAlbums();
  };

/* SAVE ALBUM */

$('albumForm').addEventListener(
  'submit',
  async event => {
    event.preventDefault();

    const {
      data: { user },
      error: userError
    } = await db.auth.getUser();

    if (userError || !user) {
      toast(
        'Please sign in again.',
        true
      );

      return;
    }

    const albumId =
      $('albumId').value;

    let coverUrl;

    try {
      coverUrl =
        await uploadCover(user.id);
    } catch (error) {
      toast(
        `Cover upload failed: ${error.message}`,
        true
      );

      return;
    }

    const albumRecord = {
      user_id: albumId
        ? $('enteredBy').value
        : user.id,

      artist:
        $('artist').value.trim(),

      title:
        $('title').value.trim(),

      release_year:
        $('releaseYear').value
          ? Number(
              $('releaseYear').value
            )
          : null,

      genre:
        $('genre').value.trim() ||
        null,

      format:
        $('format').value,

      vinyl_condition:
        $('vinylCondition').value,

      sleeve_condition:
        $('sleeveCondition').value,

      record_label:
        $('recordLabel')
          .value
          .trim() ||
        null,

      catalog_number:
        $('catalogNumber')
          .value
          .trim() ||
        null,

      country:
        $('country')
          .value
          .trim() ||
        null,

      purchase_price:
        $('purchasePrice').value
          ? Number(
              $('purchasePrice').value
            )
          : null,

      estimated_value:
        $('estimatedValue').value
          ? Number(
              $('estimatedValue').value
            )
          : null,

      acquired_date:
        $('acquiredDate').value ||
        null,

      location:
        $('location')
          .value
          .trim() ||
        null,

      cover_url: coverUrl,

      notes:
        $('notes').value.trim() ||
        null
    };

    const result = albumId
      ? await db
          .from('albums')
          .update(albumRecord)
          .eq('id', albumId)
      : await db
          .from('albums')
          .insert(albumRecord);

    if (result.error) {
      toast(
        result.error.message,
        true
      );

      return;
    }

    clearTemporaryCoverUrl();

    $('albumDialog').close();

    toast(
      albumId
        ? 'Album updated'
        : 'Album added'
    );

    await loadAlbums();
  }
);

/* CSV EXPORT */

$('exportBtn').addEventListener(
  'click',
  () => {
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

    const rows =
      filteredAlbums().map(
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
          creatorName(
            album.user_id
          ),
          album.notes
        ]
      );

    const csv = [
      headers,
      ...rows
    ]
      .map(row => {
        return row
          .map(value => {
            const escaped =
              String(value ?? '')
                .replaceAll(
                  '"',
                  '""'
                );

            return `"${escaped}"`;
          })
          .join(',');
      })
      .join('\n');

    const blob = new Blob(
      [csv],
      {
        type:
          'text/csv;charset=utf-8'
      }
    );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement('a');

    link.href = url;

    link.download =
      'karaffa-vault.csv';

    document.body.appendChild(link);

    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  }
);

start();
