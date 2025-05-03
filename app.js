// app.js
const API_URL = 'https://script.google.com/macros/s/AKfycby9sPywic_2ifeYBzE3dQMHfrwkR4-fQv-bNx74HMduvcq5Rr4r9MY6GGEYNqI44WRI/exec';

// Elemen DOM
const elements = {
    // searchInput: document.getElementById('searchInput'), // Dihapus
    institutionFilter: document.getElementById('institutionFilter'),
    scheduleGrid: document.getElementById('scheduleGrid'),
    loading: document.getElementById('loading'),
    emptyState: document.getElementById('emptyState'),
    modal: document.getElementById('genericModal'), // Detail modal
    modalTitle: document.getElementById('modalTitle'),
    modalBody: document.getElementById('modalBody'),
    closeModalBtn: document.querySelector('.close-modal'),
    modalOverlay: document.querySelector('.modal-overlay'),
    themeToggleBtn: document.getElementById('themeToggle'),
    themeOverlay: document.querySelector('.theme-transition-overlay'),
    // Elemen baru
    searchButton: document.getElementById('searchButton'),
    searchModal: document.getElementById('searchModal'),
    searchModalInput: document.getElementById('searchModalInput'),
    closeSearchModalBtn: document.querySelector('.close-search-modal'),
    searchModalOverlay: document.querySelector('.search-modal-overlay'),
    viewGridButton: document.getElementById('viewGridButton'),
    viewListButton: document.getElementById('viewListButton'),
    mainContentContainer: document.getElementById('mainContent') // Kontainer utama
};

let allSchedules = [];
let initialLoad = true;
let currentView = 'grid'; // Default view state

// ======================
// VIEW MANAGEMENT
// ======================
const initView = () => {
    const savedView = localStorage.getItem('view') || 'grid'; // Default ke grid
    switchView(savedView, false); // Terapkan tanpa menyimpan lagi
};

const switchView = (newView, save = true) => {
    if (newView !== 'grid' && newView !== 'list') return; // Hanya grid atau list
    if (!elements.mainContentContainer) return; // Pastikan container ada

    currentView = newView;

    // Update class pada container utama
    elements.mainContentContainer.classList.remove('view-grid', 'view-list');
    elements.mainContentContainer.classList.add(`view-${currentView}`);


    // Update active state pada tombol
    if(elements.viewGridButton && elements.viewListButton){
        elements.viewGridButton.classList.toggle('active', currentView === 'grid');
        elements.viewListButton.classList.toggle('active', currentView === 'list');
    }


    // Simpan preferensi jika diminta
    if (save) {
        localStorage.setItem('view', currentView);
    }
    // Sesuaikan display grid/list setelah view berubah (jika perlu, misal setelah loading)
    if (!initialLoad && elements.scheduleGrid) {
         elements.scheduleGrid.style.display = currentView === 'list' ? 'flex' : 'grid';
    }
};

// ======================
// SEARCH MODAL MANAGEMENT
// ======================
const showSearchModal = () => {
    if (elements.searchModal) {
        elements.searchModal.classList.add('visible');
        // Timeout kecil untuk memastikan transisi CSS dimulai sebelum fokus
        setTimeout(() => {
             if(elements.searchModalInput) elements.searchModalInput.focus();
        }, 50);
        document.body.style.overflow = 'hidden'; // Cegah scroll background
    }
};

const hideSearchModal = () => {
    if (elements.searchModal) {
        elements.searchModal.classList.remove('visible');
         // Hanya kembalikan scroll jika modal detail tidak terbuka
        if (!elements.modal || elements.modal.style.display === 'none') {
             document.body.style.overflow = '';
        }
    }
};


// ======================
// THEME MANAGEMENT
// ======================
const getCssVariable = (variable) => getComputedStyle(document.documentElement).getPropertyValue(variable).trim();

const initTheme = () => {
    const savedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    if (elements.themeOverlay) {
        // Set warna awal overlay sesuai tema yang di-load
        const initialBgColor = getComputedStyle(document.documentElement).getPropertyValue('--color-background').trim();
        elements.themeOverlay.style.backgroundColor = initialBgColor;

        if (savedTheme === 'dark') {
            elements.themeOverlay.style.transition = 'none';
            elements.themeOverlay.style.transform = 'translate(50%, -50%) scale(100)';
            void elements.themeOverlay.offsetHeight;
            elements.themeOverlay.style.transition = '';
        } else {
            elements.themeOverlay.style.transform = 'translate(50%, -50%) scale(0)';
        }
    }
};

const toggleTheme = () => {
    if (!elements.themeOverlay || !elements.themeToggleBtn) return;

    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    elements.themeToggleBtn.disabled = true;

    // --- Prediksi warna overlay ---
    // Buat elemen sementara untuk membaca variabel CSS tema BARU
    const tempDiv = document.createElement('div');
    tempDiv.style.display = 'none'; // Jangan tampilkan
    tempDiv.dataset.theme = newTheme; // Terapkan tema baru ke elemen sementara
    document.body.appendChild(tempDiv); // Tambahkan ke DOM agar bisa baca computed style
    const overlayColor = getComputedStyle(tempDiv).getPropertyValue('--color-background').trim();
    document.body.removeChild(tempDiv); // Hapus elemen sementara
    // --- End Prediksi warna overlay ---


    elements.themeOverlay.style.backgroundColor = overlayColor;


    if (newTheme === 'dark') {
        elements.themeOverlay.style.transform = 'translate(50%, -50%) scale(100)';
        setTimeout(() => {
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            updateThemeIcon(newTheme);
            elements.themeToggleBtn.disabled = false;
        }, 50); // Delay untuk sinkronisasi

    } else { // Ke Light Mode
        // Set tema dulu agar elemen lain mulai transisi warna di belakang overlay
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeIcon(newTheme);
        // Baru mulai animasi overlay mengecil
        elements.themeOverlay.style.transform = 'translate(50%, -50%) scale(0)';
        setTimeout(() => {
             elements.themeToggleBtn.disabled = false;
        }, 50); // Aktifkan tombol setelah delay
    }
};

const updateThemeIcon = (theme) => {
    // Icon dihandle CSS via [data-theme]
};

// ======================
// DATA MANAGEMENT
// ======================
const fetchData = async () => {
    try {
        showLoading();
        const response = await fetch(API_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        allSchedules = data
            .filter(item => item.Tanggal && item.Institusi && item.Mata_Pelajaran && item.Peserta && !isNaN(new Date(item.Tanggal).getTime()))
            .map(item => ({ ...item, TanggalDate: new Date(item.Tanggal) }))
            .filter(item => item.TanggalDate >= today)
            .sort((a, b) => a.TanggalDate - b.TanggalDate);

        initFilters(); // Inisialisasi filter dropdown & search input listener
        filterSchedules(); // Tampilkan data awal (tanpa filter search)
        attachDynamicListeners(); // Pasang listener dinamis utama

    } catch (error) {
        console.error('Fetch Error:', error);
        showError('Gagal memuat data jadwal. Periksa koneksi Anda atau coba lagi nanti.');
    } finally {
        hideLoading(); // Sembunyikan loading
        initialLoad = false;
    }
};

// ======================
// FILTER SYSTEM
// ======================
const initFilters = () => {
    // Setup Filter Institusi
    const institutions = [...new Set(allSchedules.map(item => item.Institusi))].sort((a, b) => a.localeCompare(b));
    const filterSelect = elements.institutionFilter;
    if (filterSelect) {
        filterSelect.length = 1;
        institutions.forEach(inst => {
            const option = document.createElement('option');
            option.value = inst;
            option.textContent = inst;
            filterSelect.appendChild(option);
        });
        if (!filterSelect.dataset.listenerAttached) {
             filterSelect.addEventListener('change', filterSchedules);
             filterSelect.dataset.listenerAttached = 'true';
        }
    }

     // Setup listener untuk input di search modal
     if (elements.searchModalInput && !elements.searchModalInput.dataset.listenerAttached) {
        elements.searchModalInput.addEventListener('input', debounce(filterSchedules, 300));
        elements.searchModalInput.dataset.listenerAttached = 'true';
     }
};

const filterSchedules = () => {
    // Baca search term dari input di modal
    const searchTerm = elements.searchModalInput ? elements.searchModalInput.value.toLowerCase().trim() : '';
    const selectedInstitution = elements.institutionFilter ? elements.institutionFilter.value : 'all';

    const filtered = allSchedules.filter(item => {
        const searchableText = [
            item.Institusi,
            item.Mata_Pelajaran,
            item.Peserta.join(' '),
            formatDate(item.Tanggal) // Sertakan tanggal terformat dalam pencarian
        ].join(' ').toLowerCase();

        const matchesSearch = searchTerm === '' || searchableText.includes(searchTerm);
        const matchesInstitution = selectedInstitution === 'all' || item.Institusi === selectedInstitution;

        return matchesSearch && matchesInstitution;
    });

    renderSchedules(filtered);
};

// ======================
// RENDERING
// ======================
const renderSchedules = (data) => {
    if (!elements.scheduleGrid) return;
    elements.scheduleGrid.innerHTML = ''; // Kosongkan grid

    if (data.length === 0) {
        showEmptyState(); // Tampilkan pesan kosong
        hideLoading(); // Pastikan loading hilang
        return;
    }
    hideEmptyState(); // Sembunyikan pesan kosong
    hideLoading(); // Pastikan loading hilang

    const fragment = document.createDocumentFragment();
    data.forEach(item => {
        // Struktur card sama, tampilan diatur CSS
        const card = createScheduleCard(item);
        fragment.appendChild(card);
    });
    elements.scheduleGrid.appendChild(fragment); // Tambahkan semua sekaligus
};

const createScheduleCard = (item) => {
    const card = document.createElement('article');
    card.className = 'schedule-card';
    // Gunakan data-* attribute untuk menyimpan nilai asli jika perlu
    card.innerHTML = `
        <div class="card-header">
            <h3 class="course-title clickable" data-value="${item.Mata_Pelajaran}" data-entity="Mata_Pelajaran">${item.Mata_Pelajaran}</h3>
            <span class="date-display clickable" data-value="${item.Tanggal}" data-entity="Tanggal">${formatDate(item.Tanggal)}</span>
        </div>
        <div class="institute clickable" data-value="${item.Institusi}" data-entity="Institusi">${item.Institusi}</div>
        <div class="participants">
            ${item.Peserta.map(peserta => `
                <span class="participant-tag clickable" data-value="${peserta}" data-entity="Peserta">${peserta}</span>
            `).join('')}
        </div>
    `;
    return card;
};

// ======================
// MODAL SYSTEM (Detail)
// ======================
const showGenericModal = (title, data) => {
    if (!elements.modal) return;
    elements.modalTitle.textContent = title;
    elements.modalBody.innerHTML = generateModalContent(data);
    elements.modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
};

const hideModal = () => {
    if (elements.modal) elements.modal.style.display = 'none';
    // Kembalikan scroll HANYA jika search modal juga tidak visible
    if (!elements.searchModal || !elements.searchModal.classList.contains('visible')) {
        document.body.style.overflow = '';
    }
};

const generateModalContent = (data) => {
    if (!data || data.length === 0) {
        return '<p class="no-data">Tidak ada data jadwal terkait yang ditemukan.</p>';
    }
    // Urutkan data di modal berdasarkan tanggal
    const sortedData = [...data].sort((a,b) => a.TanggalDate - b.TanggalDate); // Gunakan TanggalDate yg sudah Date object
    return sortedData.map(item => `
        <div class="modal-item">
            <div class="card-header">
                <h4 class="course-title">${item.Mata_Pelajaran}</h4>
                 <span class="date-display">${formatDate(item.TanggalDate)}</span> {/* Gunakan TanggalDate */}
            </div>
             <div class="modal-meta">
                <span class="institute">${item.Institusi}</span>
            </div>
            <div class="participants">
                ${item.Peserta.map(p => `<span class="participant-tag">${p}</span>`).join('')}
            </div>
        </div>
    `).join('');
};

// ======================
// EVENT HANDLERS
// ======================
const handleEntityClick = (element) => {
    const entityType = element.dataset.entity;
    const value = element.dataset.value; // Selalu gunakan data-value
    if (!entityType || value === undefined) return;

    let filterProperty = entityType;
    let modalTitlePrefix = '';
    let filteredData;
    const today = new Date(); today.setHours(0, 0, 0, 0);

    if (entityType === 'Peserta') {
        filteredData = allSchedules.filter(item => item.Peserta.includes(value) && item.TanggalDate >= today);
        modalTitlePrefix = `Jadwal mendatang untuk ${value}`;
    } else if (entityType === 'Tanggal') {
         const clickedDate = new Date(value); clickedDate.setHours(0,0,0,0);
         filteredData = allSchedules.filter(item =>
             item.TanggalDate.getFullYear() === clickedDate.getFullYear() &&
             item.TanggalDate.getMonth() === clickedDate.getMonth() &&
             item.TanggalDate.getDate() === clickedDate.getDate()
             // && item.TanggalDate >= today // Tampilkan semua jadwal di hari itu
         );
         modalTitlePrefix = `Jadwal pada ${formatDate(clickedDate)}`; // Format tanggal yg diklik
    } else if (entityType === 'Mata_Pelajaran' || entityType === 'Institusi') {
        filteredData = allSchedules.filter(item => item[filterProperty] === value && item.TanggalDate >= today);
        modalTitlePrefix = `Jadwal mendatang untuk ${value}`;
    } else { return; }

    showGenericModal(modalTitlePrefix, filteredData);
};

const attachDynamicListeners = () => {
    // Hanya pasang listener utama sekali pada body
     if (document.body.dataset.listenerAttached === 'true') return;

    document.body.addEventListener('click', (e) => {
        const target = e.target;
        const closestClickable = target.closest('.clickable[data-entity]');
        const closestCloseModal = target.closest('.close-modal');
        const closestCloseSearchModal = target.closest('.close-search-modal');

        if (closestClickable) { // Klik pada entitas (kartu/modal detail)
            handleEntityClick(closestClickable);
        }
        else if (target === elements.modalOverlay || closestCloseModal) { // Tutup modal detail
             hideModal();
        }
        else if (target === elements.searchModalOverlay || closestCloseSearchModal) { // Tutup modal search
            hideSearchModal();
        }
    });

    // Listener escape key global
     window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (elements.searchModal && elements.searchModal.classList.contains('visible')) {
                hideSearchModal();
            } else if (elements.modal && elements.modal.style.display === 'block') {
                hideModal();
            }
        }
    });

    document.body.dataset.listenerAttached = 'true'; // Tandai listener sudah terpasang
};

// ======================
// UTILITIES
// ======================
const formatDate = (dateStringOrDate) => {
    const date = (dateStringOrDate instanceof Date) ? dateStringOrDate : new Date(dateStringOrDate);
    if (isNaN(date.getTime())) return 'Tanggal tidak valid';
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const inputDateOnly = new Date(date); inputDateOnly.setHours(0, 0, 0, 0);
    if (inputDateOnly.getTime() === today.getTime()) return 'Hari ini';
    if (inputDateOnly.getTime() === tomorrow.getTime()) return 'Besok';
    const options = { weekday: 'long', day: 'numeric', month: 'long', year: (inputDateOnly.getFullYear() !== today.getFullYear()) ? 'numeric' : undefined };
    return inputDateOnly.toLocaleDateString('id-ID', options);
};
const showLoading = () => { if(elements.loading){elements.loading.classList.remove('hidden'); elements.loading.style.display = 'flex';} if(elements.emptyState) elements.emptyState.classList.add('hidden'); if(elements.scheduleGrid) elements.scheduleGrid.style.display = 'none'; };
const hideLoading = () => { if(elements.loading){ elements.loading.classList.add('hidden'); elements.loading.style.display = 'none';} if(elements.scheduleGrid && elements.mainContentContainer) elements.scheduleGrid.style.display = elements.mainContentContainer.classList.contains('view-list') ? 'flex' : 'grid'; };
const showEmptyState = () => { if(elements.emptyState){elements.emptyState.classList.remove('hidden'); elements.emptyState.style.display = 'flex';} if(elements.scheduleGrid) elements.scheduleGrid.style.display = 'none'; if(elements.emptyState) elements.emptyState.innerHTML = `<i class="fas fa-ghost empty-icon"></i><h3>Oops! Jadwal tidak ditemukan</h3><p>Coba kata kunci atau filter yang berbeda.</p>`; };
const hideEmptyState = () => { if(elements.emptyState){ elements.emptyState.classList.add('hidden'); elements.emptyState.style.display = 'none';} };
const showError = (message = 'Terjadi kesalahan.') => { hideLoading(); if(elements.scheduleGrid) elements.scheduleGrid.style.display = 'none'; if(elements.emptyState){ elements.emptyState.classList.remove('hidden'); elements.emptyState.style.display = 'flex'; elements.emptyState.innerHTML = `<i class="fas fa-exclamation-triangle empty-icon" style="color: #e74c3c;"></i><h3>Terjadi Kesalahan</h3><p>${message}</p>`; }};
function debounce(func, wait) { let timeout; return function executedFunction(...args) { const later = () => { clearTimeout(timeout); func(...args); }; clearTimeout(timeout); timeout = setTimeout(later, wait); }; }

// ======================
// INITIALIZATION
// ======================
document.addEventListener('DOMContentLoaded', () => {
    initTheme(); // Inisialisasi tema
    initView();  // Inisialisasi view (grid/list)
    fetchData(); // Ambil data & render awal & pasang listener dinamis

    // --- Listener Statis ---
    if(elements.themeToggleBtn) elements.themeToggleBtn.addEventListener('click', toggleTheme);
    if(elements.searchButton) elements.searchButton.addEventListener('click', showSearchModal);
    if(elements.viewGridButton) elements.viewGridButton.addEventListener('click', () => switchView('grid'));
    if(elements.viewListButton) elements.viewListButton.addEventListener('click', () => switchView('list'));
});