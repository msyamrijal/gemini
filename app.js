// c:\Users\msyam\aihhh\gemini\app.js
const API_URL = 'https://script.google.com/macros/s/AKfycby9sPywic_2ifeYBzE3dQMHfrwkR4-fQv-bNx74HMduvcq5Rr4r9MY6GGEYNqI44WRI/exec';

// Elemen DOM
const elements = {
    // institutionFilter: document.getElementById('institutionFilter'), // Dihapus
    scheduleGrid: document.getElementById('scheduleGrid'),
    loading: document.getElementById('loading'),
    emptyState: document.getElementById('emptyState'),
    modal: document.getElementById('genericModal'), // Detail modal
    modalTitle: document.getElementById('modalTitle'),
    modalBody: document.getElementById('modalBody'),
    closeModalBtn: document.querySelector('.close-modal'), // Selector lebih spesifik jika perlu
    modalOverlay: document.querySelector('#genericModal .modal-overlay'), // Lebih spesifik
    themeToggleBtn: document.getElementById('themeToggle'),
    // themeOverlay: document.querySelector('.theme-transition-overlay'), // Dihapus
    searchButton: document.getElementById('searchButton'),
    searchModal: document.getElementById('searchModal'),
    searchModalInput: document.getElementById('searchModalInput'),
    closeSearchModalBtn: document.querySelector('.close-search-modal'), // Selector lebih spesifik jika perlu
    searchModalOverlay: document.querySelector('#searchModal .modal-overlay'), // Lebih spesifik
    filterButton: document.getElementById('filterButton'), // Button filter baru
    filterDropdownMenu: document.getElementById('filterDropdownMenu'), // Menu dropdown baru
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
    // Terapkan view tanpa menyimpan lagi dan tanpa render ulang (karena data belum ada)
    switchView(savedView, false, false);
};

const switchView = (newView, save = true, reRender = true) => {
    if (newView !== 'grid' && newView !== 'list') return; // Hanya grid atau list
    if (!elements.mainContentContainer || currentView === newView) return; // Pastikan container ada & view berubah

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

    // Render ulang jadwal dengan view baru jika diminta dan data sudah ada
    if (reRender && !initialLoad && allSchedules.length > 0) {
        filterSchedules(); // Filter ulang akan memanggil render
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
        // Tambahkan kelas untuk animasi keluar jika ada
        // elements.searchModal.classList.add('hiding');
        // setTimeout(() => { // Tunggu animasi selesai
             elements.searchModal.classList.remove('visible');
             // elements.searchModal.classList.remove('hiding');
             // Hanya kembalikan scroll jika modal detail tidak terbuka
             if (!elements.modal || elements.modal.style.display === 'none') {
                  document.body.style.overflow = '';
             }
        // }, 300); // Sesuaikan dengan durasi animasi CSS
    }
};


// ======================
// THEME MANAGEMENT
// ======================
const getCssVariable = (variable) => getComputedStyle(document.documentElement).getPropertyValue(variable).trim();

const initTheme = () => {
    const savedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme); // Update ikon (jika ada logika khusus)

    // Logika overlay dihapus
};


const toggleTheme = () => {
    if (!elements.themeToggleBtn) return; // Hanya cek tombol

    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    elements.themeToggleBtn.disabled = true; // Nonaktifkan tombol selama transisi

    // Langsung ganti tema tanpa animasi overlay
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);

    // Aktifkan kembali tombol setelah transisi selesai (beri jeda singkat)
    setTimeout(() => {
        elements.themeToggleBtn.disabled = false;
    }, 100); // Jeda singkat untuk mencegah klik ganda
};


const updateThemeIcon = (theme) => {
    // Tidak perlu JS jika ikon dihandle murni oleh CSS via [data-theme]
    // Jika perlu logika JS tambahan, letakkan di sini.
};

// ======================
// DATA MANAGEMENT
// ======================
const fetchData = async () => {
    try {
        showLoading();
        const response = await fetch(API_URL);
        if (!response.ok) {
            // Coba baca pesan error dari body jika ada (format JSON)
            let errorBody = null;
            try { errorBody = await response.json(); } catch (e) { /* abaikan jika bukan json */ }
            const errorMsg = errorBody?.error || `HTTP error! status: ${response.status}`;
            throw new Error(errorMsg);
        }
        const data = await response.json();

        // Validasi data dasar
        if (!Array.isArray(data)) {
            throw new Error("Format data tidak valid (bukan array).");
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        allSchedules = data
            // Filter item yang tidak lengkap atau tanggal tidak valid
            .filter(item => item && item.Tanggal && item.Institusi && item.Mata_Pelajaran && Array.isArray(item.Peserta) && !isNaN(new Date(item.Tanggal).getTime()))
            .map(item => ({
                ...item,
                TanggalDate: new Date(item.Tanggal), // Konversi ke objek Date
                // Pastikan Peserta adalah array of strings
                Peserta: item.Peserta.map(p => String(p).trim()).filter(p => p)
            }))
            // Filter jadwal yang sudah lewat
            .filter(item => {
                const itemDate = new Date(item.TanggalDate);
                itemDate.setHours(0,0,0,0);
                return itemDate >= today;
            })
            // Urutkan berdasarkan tanggal terdekat
            .sort((a, b) => a.TanggalDate - b.TanggalDate);

        initFilters(); // Inisialisasi filter dropdown & search input listener
        filterSchedules(); // Tampilkan data awal (tanpa filter search)
        attachDynamicListeners(); // Pasang listener dinamis utama

    } catch (error) {
        console.error('Fetch Error:', error);
        showError(`Gagal memuat data jadwal. ${error.message}`);
    } finally {
        hideLoading(); // Sembunyikan loading
        initialLoad = false;
    }
};

// ======================
// FILTER SYSTEM
// ======================
const initFilters = () => {
    if (!elements.filterDropdownMenu || !elements.filterButton) return;

    // Setup Filter Institusi (Kelas) Dropdown
    const institutions = [...new Set(allSchedules.map(item => item.Institusi))].sort((a, b) => a.localeCompare(b));
    const menu = elements.filterDropdownMenu;
    menu.innerHTML = ''; // Kosongkan menu

    // Tambahkan opsi "Semua Kelas"
    const allOption = document.createElement('button');
    allOption.setAttribute('role', 'menuitem');
    allOption.dataset.value = 'all';
    allOption.textContent = 'Semua Kelas';
    allOption.classList.add('active'); // Default aktif
    menu.appendChild(allOption);

    // Tambahkan opsi untuk setiap institusi
    institutions.forEach(inst => {
        const item = document.createElement('button');
        item.setAttribute('role', 'menuitem');
        item.dataset.value = inst;
        item.textContent = inst;
        menu.appendChild(item);
    });

    // Listener untuk item dropdown (delegasi)
    if (!menu.dataset.listenerAttached) {
        menu.addEventListener('click', handleFilterItemClick);
        menu.dataset.listenerAttached = 'true';
    }

     // Setup listener untuk input di search modal
     if (elements.searchModalInput && !elements.searchModalInput.dataset.listenerAttached) {
        elements.searchModalInput.addEventListener('input', debounce(filterSchedules, 300));
        elements.searchModalInput.dataset.listenerAttached = 'true';
     }
};

const handleFilterItemClick = (e) => {
     const target = e.target.closest('button[data-value]');
     if (!target || !elements.filterButton || !elements.filterDropdownMenu) return;

     const selectedValue = target.dataset.value;
     const selectedText = target.textContent;

     // Update button text & value
     elements.filterButton.querySelector('span').textContent = selectedText;
     elements.filterButton.dataset.value = selectedValue;

     // Update active state in dropdown
     elements.filterDropdownMenu.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
     target.classList.add('active');

     // Hide dropdown & apply filter
     toggleFilterDropdown(false); // Pastikan tertutup
     filterSchedules();
};

const toggleFilterDropdown = (forceShow) => {
    if (!elements.filterButton || !elements.filterDropdownMenu) return;
    const isHidden = elements.filterDropdownMenu.classList.contains('hidden');
    const show = forceShow !== undefined ? forceShow : isHidden; // Tentukan state akhir

    elements.filterDropdownMenu.classList.toggle('hidden', !show);
    elements.filterButton.setAttribute('aria-expanded', show ? 'true' : 'false');
};

const filterSchedules = () => {
    // Baca search term dari input di modal
    const searchTerm = elements.searchModalInput ? elements.searchModalInput.value.toLowerCase().trim() : '';
    // Baca filter institusi dari data-value button
    const selectedInstitution = elements.filterButton ? elements.filterButton.dataset.value || 'all' : 'all';

    const filtered = allSchedules.filter(item => {
        // Gabungkan semua teks yang bisa dicari dari item
        const searchableText = [
            item.Institusi,
            item.Mata_Pelajaran,
            item.Peserta.join(' '), // Gabungkan nama peserta
            formatDate(item.TanggalDate) // Sertakan tanggal terformat
        ].join(' ').toLowerCase();

        // Cek kecocokan
        const matchesSearch = searchTerm === '' || searchableText.includes(searchTerm);
        const matchesInstitution = selectedInstitution === 'all' || item.Institusi === selectedInstitution;

        return matchesSearch && matchesInstitution;
     }); // <-- Kurung kurawal penutup yang hilang ditambahkan di sini

    renderSchedules(filtered); // Render hasil filter
};

// ======================
// RENDERING
// ======================
const renderSchedules = (data) => {
    if (!elements.scheduleGrid) return;
    elements.scheduleGrid.innerHTML = ''; // Kosongkan grid

    if (data.length === 0) {
        showEmptyState(); // Tampilkan pesan kosong jika tidak ada hasil
        hideLoading(); // Pastikan loading hilang
        return;
    }
    hideEmptyState(); // Sembunyikan pesan kosong jika ada hasil
    hideLoading(); // Pastikan loading hilang

    const fragment = document.createDocumentFragment();
    data.forEach(item => {
        const card = createScheduleCard(item);
        fragment.appendChild(card);
    });
    elements.scheduleGrid.appendChild(fragment); // Tambahkan semua kartu sekaligus
};

const createScheduleCard = (item) => {
    const card = document.createElement('article');
    // Kelas dasar + kelas view spesifik jika diperlukan (meski styling utama via container)
    card.className = 'schedule-card';
    // Gunakan data-* attribute untuk menyimpan nilai asli untuk klik
    card.innerHTML = `
        <div class="card-header">
            <h3 class="course-title clickable" data-value="${item.Mata_Pelajaran}" data-entity="Mata_Pelajaran">${item.Mata_Pelajaran}</h3>
            <span class="date-display clickable" data-value="${item.TanggalDate.toISOString()}" data-entity="Tanggal">${formatDate(item.TanggalDate)}</span>
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
    if (!elements.modal || !elements.modalTitle || !elements.modalBody) return;
    elements.modalTitle.textContent = title;
    elements.modalBody.innerHTML = generateModalContent(data);
    elements.modal.style.display = 'block'; // Tampilkan modal
    document.body.style.overflow = 'hidden'; // Cegah scroll background
};

const hideModal = () => {
    if (elements.modal) {
        // elements.modal.classList.add('hiding'); // Jika pakai animasi keluar
        // setTimeout(() => {
            elements.modal.style.display = 'none';
            // elements.modal.classList.remove('hiding');
            // Kembalikan scroll HANYA jika search modal juga tidak visible
            if (!elements.searchModal || !elements.searchModal.classList.contains('visible')) {
                document.body.style.overflow = '';
            }
        // }, 300); // Durasi animasi
    }
};

const generateModalContent = (data) => {
    if (!data || data.length === 0) {
        return '<p class="no-data">Tidak ada data jadwal terkait yang ditemukan.</p>';
    }
    // Urutkan data di modal berdasarkan tanggal (seharusnya sudah Date object)
    const sortedData = [...data].sort((a,b) => a.TanggalDate - b.TanggalDate);
    return sortedData.map(item => `
        <div class="modal-item">
            <div class="card-header">
                <h4 class="course-title">${item.Mata_Pelajaran}</h4>
                 <span class="date-display">${formatDate(item.TanggalDate)}</span>
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
    const value = element.dataset.value; // Ambil nilai dari data-value
    if (!entityType || value === undefined) return;

    let filterProperty = entityType;
    let modalTitlePrefix = '';
    let filteredData;
    const today = new Date(); today.setHours(0, 0, 0, 0);

    // Filter data berdasarkan entity yang diklik
    if (entityType === 'Peserta') {
        // Cari semua jadwal mendatang yang mengandung peserta ini
        filteredData = allSchedules.filter(item => item.Peserta.includes(value) && item.TanggalDate >= today);
        modalTitlePrefix = `Jadwal mendatang untuk ${value}`;
    } else if (entityType === 'Tanggal') {
         // Konversi value (ISO string) kembali ke Date object hanya untuk perbandingan
         const clickedDate = new Date(value); clickedDate.setHours(0,0,0,0);
         // Cari semua jadwal pada tanggal tersebut (termasuk yang sudah lewat jika diinginkan, atau >= today)
         filteredData = allSchedules.filter(item => {
             const itemDate = new Date(item.TanggalDate); itemDate.setHours(0,0,0,0);
             return itemDate.getTime() === clickedDate.getTime();
             // Jika hanya ingin yang mendatang pada hari itu: && itemDate >= today
         });
         modalTitlePrefix = `Jadwal pada ${formatDate(clickedDate)}`; // Format tanggal yg diklik
    } else if (entityType === 'Mata_Pelajaran' || entityType === 'Institusi') {
        // Cari semua jadwal mendatang untuk mapel/institusi ini
        filteredData = allSchedules.filter(item => item[filterProperty] === value && item.TanggalDate >= today);
        modalTitlePrefix = `Jadwal mendatang untuk ${value}`;
    } else {
        return; // Tipe entity tidak dikenal
    }

    showGenericModal(modalTitlePrefix, filteredData); // Tampilkan modal detail
};

const attachDynamicListeners = () => {
    // Gunakan event delegation pada body untuk menangani klik dinamis
     if (document.body.dataset.listenerAttached === 'true') return; // Cegah pemasangan ganda

    document.body.addEventListener('click', (e) => {
        const target = e.target;

        // Cek klik pada elemen 'clickable' di dalam kartu atau modal
        const closestClickable = target.closest('.clickable[data-entity]');
        if (closestClickable) {
            handleEntityClick(closestClickable);
            return; // Hentikan pengecekan lebih lanjut
        }

        // Cek klik pada tombol close modal detail atau overlaynya
        if (target === elements.modalOverlay || target.closest('.close-modal')) {
             hideModal();
             return;
        }

        // Cek klik pada tombol close modal search atau overlaynya
        if (target === elements.searchModalOverlay || target.closest('.close-search-modal')) {
            hideSearchModal();
            return;
        }

        // Cek klik di luar filter dropdown untuk menutupnya
        const filterContainer = target.closest('.filter-dropdown-container');
        if (!filterContainer && elements.filterDropdownMenu && !elements.filterDropdownMenu.classList.contains('hidden')) {
            toggleFilterDropdown(false); // Tutup dropdown
        }
    });

    // Listener escape key global untuk menutup modal yang aktif
     window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            // Prioritaskan tutup search modal jika terbuka
            if (elements.searchModal && elements.searchModal.classList.contains('visible')) {
                hideSearchModal();
            }
            // Jika search modal tidak terbuka, coba tutup modal detail
            else if (elements.modal && elements.modal.style.display === 'block') {
                hideModal();
            }
            // Jika tidak ada modal, coba tutup filter dropdown
            else if (elements.filterDropdownMenu && !elements.filterDropdownMenu.classList.contains('hidden')) {
                toggleFilterDropdown(false);
            }
        }
    });

    document.body.dataset.listenerAttached = 'true'; // Tandai listener sudah terpasang
};

// ======================
// UTILITIES
// ======================
const formatDate = (dateInput) => {
    // Terima Date object atau string ISO
    const date = (dateInput instanceof Date) ? dateInput : new Date(dateInput);
    if (isNaN(date.getTime())) return 'Tanggal tidak valid';

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const inputDateOnly = new Date(date); inputDateOnly.setHours(0, 0, 0, 0);

    if (inputDateOnly.getTime() === today.getTime()) return 'Hari ini';
    if (inputDateOnly.getTime() === tomorrow.getTime()) return 'Besok';

    // Opsi format: Tampilkan tahun jika bukan tahun ini
    const options = {
        weekday: 'long', day: 'numeric', month: 'long',
        year: (inputDateOnly.getFullYear() !== today.getFullYear()) ? 'numeric' : undefined
    };
    return inputDateOnly.toLocaleDateString('id-ID', options);
};

const showLoading = () => {
    if(elements.loading) { elements.loading.classList.remove('hidden'); elements.loading.style.display = 'flex'; }
    if(elements.emptyState) { elements.emptyState.classList.add('hidden'); elements.emptyState.style.display = 'none'; }
    if(elements.scheduleGrid) elements.scheduleGrid.style.display = 'none'; // Sembunyikan grid saat loading
};

const hideLoading = () => {
    if(elements.loading) { elements.loading.classList.add('hidden'); elements.loading.style.display = 'none'; }
    // Tampilkan grid sesuai view saat ini HANYA jika tidak kosong
    if(elements.scheduleGrid && elements.mainContentContainer && !elements.emptyState?.classList.contains('hidden')) {
         // Jika empty state tampil, grid tetap none
         elements.scheduleGrid.style.display = 'none';
    } else if (elements.scheduleGrid && elements.mainContentContainer) {
        // Jika tidak loading dan tidak empty, tampilkan grid sesuai view
        elements.scheduleGrid.style.display = elements.mainContentContainer.classList.contains('view-list') ? 'flex' : 'grid';
    }
};

const showEmptyState = (message = "Oops! Jadwal tidak ditemukan", subMessage = "Coba kata kunci atau filter yang berbeda.") => {
    if(elements.emptyState) {
        elements.emptyState.classList.remove('hidden');
        elements.emptyState.style.display = 'flex';
        elements.emptyState.innerHTML = `
            <i class="fas fa-ghost empty-icon"></i>
            <h3>${message}</h3>
            <p>${subMessage}</p>`;
    }
    if(elements.scheduleGrid) elements.scheduleGrid.style.display = 'none'; // Sembunyikan grid saat kosong
    hideLoading(); // Pastikan loading juga hilang
};

const hideEmptyState = () => {
    if(elements.emptyState) {
        elements.emptyState.classList.add('hidden');
        elements.emptyState.style.display = 'none';
    }
    // Jangan langsung tampilkan grid di sini, biarkan hideLoading() yg atur
};

const showError = (message = 'Terjadi kesalahan.') => {
    hideLoading(); // Sembunyikan loading dulu
    if(elements.scheduleGrid) elements.scheduleGrid.style.display = 'none'; // Sembunyikan grid
    if(elements.emptyState) {
        elements.emptyState.classList.remove('hidden');
        elements.emptyState.style.display = 'flex';
        elements.emptyState.innerHTML = `
            <i class="fas fa-exclamation-triangle empty-icon" style="color: #e74c3c;"></i>
            <h3>Terjadi Kesalahan</h3>
            <p>${message}</p>`;
    }
};

// Debounce function: Menunda eksekusi fungsi sampai setelah `wait` ms tidak ada pemanggilan baru.
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func.apply(this, args); // Gunakan apply untuk menjaga konteks 'this'
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ======================
// INITIALIZATION
// ======================
document.addEventListener('DOMContentLoaded', () => {
    // Pastikan semua elemen penting ada sebelum lanjut
    if (!elements.mainContentContainer || !elements.scheduleGrid || !elements.themeToggleBtn || !elements.searchButton || !elements.filterButton || !elements.viewGridButton || !elements.viewListButton) {
        console.error("Initialization failed: One or more essential elements not found.");
        showError("Gagal menginisialisasi halaman. Elemen penting tidak ditemukan.");
        return;
    }

    initTheme(); // 1. Inisialisasi tema (penting sebelum fetch agar warna loading benar)
    initView();  // 2. Inisialisasi view (grid/list)
    fetchData(); // 3. Ambil data & render awal & pasang listener filter/search & dinamis

    // --- Listener Statis (untuk tombol header, dll) ---
    elements.themeToggleBtn.addEventListener('click', toggleTheme);
    elements.searchButton.addEventListener('click', showSearchModal);
    elements.filterButton.addEventListener('click', () => toggleFilterDropdown()); // Toggle dropdown
    elements.viewGridButton.addEventListener('click', () => switchView('grid'));
    elements.viewListButton.addEventListener('click', () => switchView('list'));

    // Listener dinamis utama dipasang di dalam fetchData setelah data berhasil diambil
});
