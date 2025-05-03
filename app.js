// app.js
const API_URL = 'https://script.google.com/macros/s/AKfycby9sPywic_2ifeYBzE3dQMHfrwkR4-fQv-bNx74HMduvcq5Rr4r9MY6GGEYNqI44WRI/exec';

// Elemen DOM
const elements = {
    searchInput: document.getElementById('searchInput'),
    institutionFilter: document.getElementById('institutionFilter'),
    scheduleGrid: document.getElementById('scheduleGrid'),
    loading: document.getElementById('loading'),
    emptyState: document.getElementById('emptyState'),
    modal: document.getElementById('genericModal'),
    modalTitle: document.getElementById('modalTitle'),
    modalBody: document.getElementById('modalBody'),
    closeModalBtn: document.querySelector('.close-modal'),
    modalOverlay: document.querySelector('.modal-overlay'),
    themeToggleBtn: document.getElementById('themeToggle'),
    // Tambahkan elemen overlay
    themeOverlay: document.querySelector('.theme-transition-overlay')
};

let allSchedules = [];
let initialLoad = true; // Flag for initial load animation

// ======================
// THEME MANAGEMENT
// ======================
const initTheme = () => {
    const savedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    // Set kondisi awal overlay tanpa animasi saat load
    if (elements.themeOverlay) { // Pastikan elemen ada
        if (savedTheme === 'dark') {
            elements.themeOverlay.style.backgroundColor = '#282C34'; // Dark bg color from CSS variable
            // Langsung set skala besar tanpa transisi saat load
            elements.themeOverlay.style.transition = 'none'; // Matikan transisi sementara
            elements.themeOverlay.style.transform = 'translate(50%, -50%) scale(100)';
            // Paksa reflow agar style diterapkan sebelum mengaktifkan transisi lagi
            void elements.themeOverlay.offsetHeight;
            elements.themeOverlay.style.transition = ''; // Aktifkan lagi transisi dari CSS
        } else {
            elements.themeOverlay.style.backgroundColor = '#FDFCFB'; // Light bg color from CSS variable
            elements.themeOverlay.style.transform = 'translate(50%, -50%) scale(0)';
        }
    }
};

const toggleTheme = () => {
    // Pastikan elemen overlay ada
    if (!elements.themeOverlay) return;

    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    // Nonaktifkan tombol sementara untuk mencegah klik ganda selama transisi
    elements.themeToggleBtn.disabled = true;

    // Tentukan warna overlay berdasarkan tema BARU
    const overlayColor = newTheme === 'dark' ? '#282C34' : '#FDFCFB'; // Target background color
    elements.themeOverlay.style.backgroundColor = overlayColor;

    if (newTheme === 'dark') {
        // 1. Mulai animasi overlay membesar
        elements.themeOverlay.style.transform = 'translate(50%, -50%) scale(100)';

        // 2. Tunggu sebentar lalu ubah atribut tema
        setTimeout(() => {
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            updateThemeIcon(newTheme);
            // Aktifkan tombol kembali setelah atribut berubah
            elements.themeToggleBtn.disabled = false;
        }, 50); // Delay kecil sebelum ganti atribut

    } else { // Transisi ke light mode
        // 1. Ubah atribut tema SEGERA
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeIcon(newTheme);

        // 2. Mulai animasi overlay mengecil
         elements.themeOverlay.style.transform = 'translate(50%, -50%) scale(0)';

        // 3. Aktifkan tombol kembali setelah animasi dimulai
        setTimeout(() => {
             elements.themeToggleBtn.disabled = false;
        }, 50); // Aktifkan setelah delay singkat
    }
};

const updateThemeIcon = (theme) => {
    const themeIcon = elements.themeToggleBtn.querySelector('.theme-icon');
    // Perubahan ikon ditangani oleh CSS via [data-theme] selector
    // Jika perlu manipulasi ikon spesifik di JS, tambahkan di sini
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
            .filter(item => {
                return item.Tanggal && item.Institusi && item.Mata_Pelajaran && item.Peserta && !isNaN(new Date(item.Tanggal).getTime());
            })
            .map(item => ({ ...item, TanggalDate: new Date(item.Tanggal) }))
            .filter(item => item.TanggalDate >= today)
            .sort((a, b) => a.TanggalDate - b.TanggalDate);

        initFilters();
        filterSchedules();
        attachDynamicListeners(); // Pindahkan ke sini agar listener hanya sekali

    } catch (error) {
        console.error('Fetch Error:', error);
        showError('Gagal memuat data jadwal. Periksa koneksi Anda atau coba lagi nanti.');
    } finally {
        hideLoading();
        initialLoad = false;
    }
};

// ======================
// FILTER SYSTEM
// ======================
const initFilters = () => {
    const institutions = [...new Set(allSchedules.map(item => item.Institusi))].sort((a, b) => a.localeCompare(b));
    const filterSelect = elements.institutionFilter;
    filterSelect.length = 1; // Keep only the default option

    institutions.forEach(inst => {
        const option = document.createElement('option');
        option.value = inst;
        option.textContent = inst;
        filterSelect.appendChild(option);
    });

    // Pindahkan listener filter ke sini agar hanya ditambah sekali saat init
    if (!filterSelect.dataset.listenerAttached) {
        elements.searchInput.addEventListener('input', debounce(filterSchedules, 300));
        filterSelect.addEventListener('change', filterSchedules);
        filterSelect.dataset.listenerAttached = 'true'; // Tandai listener sudah terpasang
    }
};

const filterSchedules = () => {
    const searchTerm = elements.searchInput.value.toLowerCase().trim();
    const selectedInstitution = elements.institutionFilter.value;

    const filtered = allSchedules.filter(item => {
        const searchableText = [
            item.Institusi,
            item.Mata_Pelajaran,
            item.Peserta.join(' '),
            formatDate(item.Tanggal) // Cari berdasarkan tanggal terformat juga
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
    elements.scheduleGrid.innerHTML = '';

    if (data.length === 0) {
        showEmptyState();
        hideLoading();
        return;
    }

    hideEmptyState();
    hideLoading();

    const fragment = document.createDocumentFragment();
    data.forEach(item => {
        const card = createScheduleCard(item);
        fragment.appendChild(card);
    });
    elements.scheduleGrid.appendChild(fragment);
};

const createScheduleCard = (item) => {
    const card = document.createElement('article');
    card.className = 'schedule-card';
    // Tambahkan data-entity ke elemen yang bisa diklik
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
// MODAL SYSTEM
// ======================
const showGenericModal = (title, data) => {
    elements.modalTitle.textContent = title;
    elements.modalBody.innerHTML = generateModalContent(data);
    elements.modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
};

const hideModal = () => {
    elements.modal.style.display = 'none';
    document.body.style.overflow = '';
};

const generateModalContent = (data) => {
    if (!data || data.length === 0) {
        return '<p class="no-data">Tidak ada data jadwal terkait yang ditemukan.</p>';
    }

    // Urutkan data di modal berdasarkan tanggal
    const sortedData = data.sort((a,b) => new Date(a.Tanggal) - new Date(b.Tanggal));

    return sortedData.map(item => `
        <div class="modal-item">
            <div class="card-header">
                <h4 class="course-title">${item.Mata_Pelajaran}</h4>
                 <span class="date-display">${formatDate(item.Tanggal)}</span>
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
    const value = element.dataset.value || element.textContent; // Gunakan data-value jika ada
    let filterProperty = entityType;
    let modalTitlePrefix = '';
    let filteredData;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Filter data berdasarkan entity yang diklik
    if (entityType === 'Peserta') {
        filteredData = allSchedules.filter(item => item.Peserta.includes(value) && item.TanggalDate >= today);
        modalTitlePrefix = `Jadwal mendatang untuk ${value}`;
    } else if (entityType === 'Tanggal') {
         const clickedDate = new Date(value);
         clickedDate.setHours(0,0,0,0);
         // Filter berdasarkan objek Date yang sudah diproses
         filteredData = allSchedules.filter(item =>
             item.TanggalDate.getFullYear() === clickedDate.getFullYear() &&
             item.TanggalDate.getMonth() === clickedDate.getMonth() &&
             item.TanggalDate.getDate() === clickedDate.getDate() &&
             item.TanggalDate >= today // Pastikan hanya masa depan
         );
         modalTitlePrefix = `Jadwal pada ${formatDate(value)}`;
    } else if (entityType === 'Mata_Pelajaran' || entityType === 'Institusi') {
        filteredData = allSchedules.filter(item => item[filterProperty] === value && item.TanggalDate >= today);
        modalTitlePrefix = `Jadwal mendatang ${value}`;
    } else {
        return; // Tipe entity tidak dikenal
    }

    showGenericModal(modalTitlePrefix, filteredData);
};


// Gunakan event delegation untuk elemen dinamis (kartu & modal)
const attachDynamicListeners = () => {
    // Listener utama pada body untuk klik
    document.body.addEventListener('click', (e) => {
        const target = e.target;

        // Handle klik pada elemen 'clickable' di dalam kartu atau modal
        if (target.classList.contains('clickable') && target.dataset.entity) {
            handleEntityClick(target);
        }

        // Handle penutupan modal
        if (target === elements.modalOverlay || target === elements.closeModalBtn || target.closest('.close-modal')) {
             hideModal();
        }
    });

    // Listener untuk tombol escape (sekali saja)
     if (!window.escapeListenerAttached) {
         window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && elements.modal.style.display === 'block') {
                hideModal();
            }
        });
        window.escapeListenerAttached = true; // Tandai listener sudah terpasang
     }
};

// ======================
// UTILITIES
// ======================
const formatDate = (dateStringOrDate) => {
    const date = (dateStringOrDate instanceof Date) ? dateStringOrDate : new Date(dateStringOrDate);

    if (isNaN(date.getTime())) {
        return 'Tanggal tidak valid';
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const inputDateOnly = new Date(date);
    inputDateOnly.setHours(0, 0, 0, 0);

    // Cek apakah hari ini atau besok
    if (inputDateOnly.getTime() === today.getTime()) {
        return 'Hari ini';
    }
    if (inputDateOnly.getTime() === tomorrow.getTime()) {
        return 'Besok';
    }

    // Format lengkap untuk tanggal lain
    const options = {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: (inputDateOnly.getFullYear() !== today.getFullYear()) ? 'numeric' : undefined
    };
    return inputDateOnly.toLocaleDateString('id-ID', options);
};


const showLoading = () => {
    elements.loading.classList.remove('hidden');
    elements.loading.style.display = 'flex';
    elements.emptyState.classList.add('hidden');
    elements.scheduleGrid.style.display = 'none';
};

const hideLoading = () => {
    elements.loading.classList.add('hidden');
    elements.loading.style.display = 'none';
    elements.scheduleGrid.style.display = 'grid';
};

const showEmptyState = () => {
    elements.emptyState.classList.remove('hidden');
    elements.emptyState.style.display = 'flex';
    elements.scheduleGrid.style.display = 'none';
    elements.emptyState.innerHTML = `
        <i class="fas fa-ghost empty-icon"></i>
        <h3>Oops! Jadwal tidak ditemukan</h3>
        <p>Coba kata kunci atau filter yang berbeda.</p>
    `;
};

const hideEmptyState = () => {
    elements.emptyState.classList.add('hidden');
    elements.emptyState.style.display = 'none';
};

const showError = (message = 'Terjadi kesalahan.') => {
    hideLoading();
    elements.scheduleGrid.style.display = 'none';
    elements.emptyState.classList.remove('hidden');
    elements.emptyState.style.display = 'flex';
    elements.emptyState.innerHTML = `
        <i class="fas fa-exclamation-triangle empty-icon" style="color: #e74c3c;"></i>
        <h3>Terjadi Kesalahan</h3>
        <p>${message}</p>
    `;
};

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}


// ======================
// INITIALIZATION
// ======================
document.addEventListener('DOMContentLoaded', () => {
    initTheme(); // Inisialisasi tema (termasuk overlay)
    fetchData(); // Ambil data jadwal

    // Listener statis (hanya perlu sekali)
    elements.themeToggleBtn.addEventListener('click', toggleTheme);

    // Listener dinamis (untuk kartu & modal) sudah dipanggil di dalam fetchData setelah data siap
    // attachDynamicListeners(); // Tidak perlu di sini lagi
});
