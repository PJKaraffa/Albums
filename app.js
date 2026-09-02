const SUPABASE_URL =
  'https://relmecpdjifmlmeyubof.supabase.co';

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
let coverPreviewObjectUrl = null;

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

/* =========================================
   GENERAL HELPERS
========================================= */

function toast(message, isError = false) {
  const element = $('toast');

  element.textContent = message;

  element.className = isError
    ? 'toast show error'
    : 'toast show';

  window.setTimeout(() => {
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
  return String(value).replace(
    /[&<>'"]/g,
    character => {
      const replacements = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      };

      return replacements[character];
    }
  );
}

function creatorName(userId) {
  const profile = profiles.find(
    item => item.id === userId
  );

  return profile?.username || 'Unknown';
}

/* =========================================
   START APPLICATION
========================================= */

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
      window.setTimeout(() => {
        updateSession(newSession);
      }, 0);
    }
  );
}

/* =========================================
   AUTHENTICATION
========================================= */

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
    creatorName(currentUser.id) ||
    currentUser.email;

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
            data: {
              username
            }
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
      await db.auth.signInWithPassword({
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

    $('usernameField').classList.toggle(
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

/* =========================================
   USER PROFILES
========================================= */

async function ensureProfile(user) {
  const {
    data: existingProfile,
    error: profileError
  } = await db
    .from('profiles')
    .select('id, username')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    toast(profileError.message, true);
    return;
  }

  if (!existingProfile) {
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
}

/* =========================================
   LOAD COLLECTION
========================================= */

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

/* =========================================
   FILTER DROPDOWNS
========================================= */

function populateGenres() {
  const selectedGenre =
    $('genreFilter').value;

  const genres = [
    ...new Set(
      albums
        .map(album => album.genre)
        .filter(Boolean)
    )
  ].sort((first, second) =>
    first.localeCompare(second)
  );

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

  if (genres.includes(selectedGenre)) {
    $('genreFilter').value =
      selectedGenre;
  }
}

function populateCollectors() {
  const selectedCollector =
    $('collectorFilter').value;

  const collectors = [
    ...new Set(
      albums.map(album =>
        creatorName(album.user_id)
      )
    )
  ].sort((first, second) =>
    first.localeCompare(second)
  );

  $('collectorFilter').innerHTML =
    '<option value="">All collectors</option>' +
    collectors
      .map(collector => {
        return `
          <option value="${safe(collector)}">
            ${safe(collector)}
          </option>
        `;
      })
      .join('');

  if (
    collectors.includes(
      selectedCollector
    )
  ) {
    $('collectorFilter').value =
      selectedCollector;
  }
}

/* =========================================
   FILTER AND SORT ALBUMS
========================================= */

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

/* =========================================
   DISPLAY COLLECTION
========================================= */

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

  const visibleGenres =
    new Set(
      visibleAlbums
        .map(album => album.genre)
        .filter(Boolean)
    );

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
    visibleGenres.size;

  if (gradeNumbers.length > 0) {
    const gradeTotal =
      gradeNumbers.reduce(
        (total, grade) =>
          total + grade,
        0
      );

    const averageGrade =
      gradeTotal /
      gradeNumbers.length;

    const conditionName =
      conditions[
        Math.round(averageGrade)
      ];

    const conditionMatch =
      conditionName.match(
        /\((.*?)\)/
      );

    $('avgCondition').textContent =
      conditionMatch
        ? conditionMatch[1]
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
      .map(album => {
        return buildAlbumCard(album);
      })
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

  const coverImage =
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

  const ownerControls =
    album.user_id === currentUser?.id
      ? `
        <button
          type="button"
          onclick="editAlbum('${album.id}')"
          title="Edit album"
          aria-label="Edit album"
        >
          ✎
        </button>

        <button
          type="button"
          class="delete"
          onclick="deleteAlbum('${album.id}')"
          title="Delete album"
          aria-label="Delete album"
        >
          ⌫
        </button>
      `
      : '';

  return `
    <article class="album-card">
      <div class="cover">
        ${coverImage}
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
            ${ownerControls}
          </div>
        </div>
      </div>
    </article>
  `;
}

/* =========================================
   SEARCH AND FILTER EVENTS
========================================= */

[
  'search',
  'genreFilter',
  'conditionFilter',
  'collectorFilter',
  'sort'
].forEach(id => {
  const element = $(id);

  if (!element) {
    console.error(
      `Missing HTML element: #${id}`
    );

    return;
  }

  const eventName =
    id === 'search'
      ? 'input'
      : 'change';

  element.addEventListener(
    eventName,
    render
  );
});

/* =========================================
   ALBUM COVER
========================================= */

function clearObjectUrl() {
  if (coverPreviewObjectUrl) {
    URL.revokeObjectURL(
      coverPreviewObjectUrl
    );

    coverPreviewObjectUrl = null;
  }
}

function showCoverPreview(source = '') {
  const image =
    $('coverPreview');

  const prompt =
    $('coverPrompt');

  image.classList.toggle(
    'hidden',
    !source
  );

  prompt.classList.toggle(
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

  if (
    !allowedTypes.includes(file.type)
  ) {
    toast(
      'Please choose a JPG, PNG, or WEBP image.',
      true
    );

    return;
  }

  const maximumSize =
    5 * 1024 * 1024;

  if (file.size > maximumSize) {
    toast(
      'Cover images must be 5 MB or smaller.',
      true
    );

    return;
  }

  clearObjectUrl();

  pendingCoverFile = file;

  $('coverUrl').value = '';

  coverPreviewObjectUrl =
    URL.createObjectURL(file);

  showCoverPreview(
    coverPreviewObjectUrl
  );
}

async function uploadCover(userId) {
  if (!pendingCoverFile) {
    return (
      $('coverUrl').value.trim() ||
      null
    );
  }

  const fileName =
    pendingCoverFile.name || '';

  const originalExtension =
    fileName.includes('.')
      ? fileName.split('.').pop()
      : '';

  const mimeExtension =
    pendingCoverFile.type
      .split('/')
      .pop();

  const extension = String(
    originalExtension ||
    mimeExtension ||
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
    extension;

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
  () => {
    $('coverFile').click();
  }
);

$('coverFile').addEventListener(
  'change',
  event => {
    const file =
      event.target.files?.[0];

    selectCover(file);
  }
);

$('coverDropZone').addEventListener(
  'click',
  event => {
    const clickedButton =
      event.target.closest(
        '#chooseCover'
      );

    if (!clickedButton) {
      $('coverFile').click();
    }
  }
);

[
  'dragenter',
  'dragover'
].forEach(eventName => {
  $('coverDropZone').addEventListener(
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
  $('coverDropZone').addEventListener(
    eventName,
    event => {
      event.preventDefault();

      $('coverDropZone')
        .classList.remove(
          'dragging'
        );

      if (eventName === 'drop') {
        const file =
          event.dataTransfer
            .files?.[0];

        selectCover(file);
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

    const clipboardItems =
      Array.from(
        event.clipboardData?.items ||
        []
      );

    const imageItem =
      clipboardItems.find(item =>
        item.type.startsWith(
          'image/'
        )
      );

    const file =
      imageItem?.getAsFile();

    if (file) {
      event.preventDefault();
      selectCover(file);
    }
  }
);

$('coverUrl').addEventListener(
  'change',
  () => {
    clearObjectUrl();

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
    clearObjectUrl();

    pendingCoverFile = null;

    $('coverFile').value = '';
    $('coverUrl').value = '';

    showCoverPreview('');
  }
);

/* =========================================
   OPEN ADD/EDIT WINDOW
========================================= */

function openDialog(album = {}) {
  $('albumForm').reset();

  clearObjectUrl();

  pendingCoverFile = null;

  $('coverFile').value = '';

  const isEditing =
    Boolean(album.id);

  $('albumId').value =
    album.id || '';

  $('dialogTitle').textContent =
    isEditing
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

  const fieldMap = {
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

  Object.entries(fieldMap).forEach(
    ([elementId, databaseField]) => {
      const value =
        album[databaseField];

      if (
        value !== undefined &&
        value !== null
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

/* =========================================
   ADD BUTTONS
========================================= */

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
    clearObjectUrl();
    $('albumDialog').close();
  }
);

$('cancelBtn').addEventListener(
  'click',
  () => {
    clearObjectUrl();
    $('albumDialog').close();
  }
);

/* =========================================
   EDIT AND DELETE
========================================= */

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
      window.confirm(
        'Remove this album from the collection?'
      );

    if (!confirmed) {
      return;
    }

    const { error } = await db
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

/* =========================================
   SAVE ALBUM
========================================= */

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
        'Your session has expired. Please sign in again.',
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
        $('country').value.trim() ||
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
        $('location').value.trim() ||
        null,

      cover_url:
        coverUrl,

      notes:
        $('notes').value.trim() ||
        null
    };

    let result;

    if (albumId) {
      result = await db
        .from('albums')
        .update(albumRecord)
        .eq('id', albumId);
    } else {
      result = await db
        .from('albums')
        .insert(albumRecord);
    }

    if (result.error) {
      toast(
        result.error.message,
        true
      );

      return;
    }

    clearObjectUrl();

    $('albumDialog').close();

    toast(
      albumId
        ? 'Album updated'
        : 'Album added'
    );

    await loadAlbums();
  }
);

/* =========================================
   EXPORT CSV
========================================= */

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

    const downloadUrl =
      URL.createObjectURL(blob);

    const link =
      document.createElement('a');

    link.href = downloadUrl;
    link.download =
      'karaffa-vault.csv';

    document.body.appendChild(link);

    link.click();
    link.remove();

    URL.revokeObjectURL(
      downloadUrl
    );
  }
);

/* =========================================
   BEGIN
========================================= */

start();
