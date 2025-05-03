// app.js
document.addEventListener('DOMContentLoaded', () => {
    // URL API Google Apps Script
    const API_URL = 'https://script.google.com/macros/s/AKfycby9sPywic_2ifeYBzE3dQMHfrwkR4-fQv-bNx74HMduvcq5Rr4r9MY6GGEYNqI44WRI/exec';

    // Elemen DOM yang sering digunakan
    const elements = {
        searchInput: document.getElementById('searchInput'),
        searchToggleBtn: document.getElementById('searchToggleBtn'), // Tombol ikon search
        searchArea: document.querySelector('.search-area'),        // Area pembungkus search
        institutionFilter: document.getElementById('institutionFilter'),
        scheduleGrid: document.getElementById('scheduleGrid'),
        loading: document.getElementById('loading'),
        emptyState: document.getElementById('emptyState'),
        modal: document.getElementById('genericModal'),
        modalTitle: document.getElementById('modalTitle'),
        modalBody: document.getElementById('modalBody'),
        closeModalBtn: document.querySelector('.close-modal'),
        modalOverlay: document.querySelector('.modal-overlay'),
        themeToggleBtn: document.getElementById('themeToggle')
    };

    // Menyimpan semua data jadwal setelah diambil
    let allSchedules = [];
    // Menyimpan timeout ID untuk debounce pencarian
    let searchDebounceTimeout;

    // ======================
    // MANAJEMEN TEMA (TERANG/GELAP)
    // ======================
    const initTheme = () => {
        // Mendapatkan tema tersimpan atau preferensi sistem
        const savedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        document.documentElement.setAttribute('data-theme', savedTheme);
    };

    const toggleTheme = () => {
        // Mengganti tema saat ini
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme); // Simpan tema baru
    };

    // ======================
    // MANAJEMEN DATA
    // ======================
    const fetchData = async () => {
        showLoading(); // Tampilkan indikator loading
        hideEmptyState(); // Sembunyikan pesan kosong
        elements.scheduleGrid.style.opacity = '0'; // Sembunyikan grid saat loading

        try {
            const response = await fetch(API_URL);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();

            const today = new Date();
            today.setHours(0, 0, 0, 0); // Set ke awal hari ini

            // Proses, filter, dan urutkan data
            allSchedules = data
                .filter(item =>
                    item.Tanggal && item.Institusi && item.Mata_Pelajaran && Array.isArray(item.Peserta) && !isNaN(new Date(item.Tanggal).getTime())
                )
                .map(item => ({ ...item, TanggalDate: new Date(item.Tanggal) }))
                .filter(item => item.TanggalDate >= today)
                .sort((a, b) => a.TanggalDate - b.TanggalDate);

            initFilters(); // Inisialisasi opsi filter institusi
            filterSchedules(); // Render jadwal awal

        } catch (error) {
            console.error('Fetch Error:', error);
            showError('Gagal memuat data jadwal. Periksa koneksi Anda atau coba lagi nanti.');
        } finally {
            hideLoading(); // Sembunyikan indikator loading
            elements.scheduleGrid.style.opacity = '1'; // Tampilkan grid setelah selesai
        }
    };

    // ======================
    // SISTEM FILTER
    // ======================
    const initFilters = () => {
        // Dapatkan daftar institusi unik dan urutkan
        const institutions = [...new Set(allSchedules.map(item => item.Institusi))].sort((a, b) => a.localeCompare(b));
        const filterSelect = elements.institutionFilter;

        // Kosongkan opsi lama (kecuali opsi default)
        filterSelect.length = 1;

        // Tambahkan opsi institusi baru
        const fragment = document.createDocumentFragment();
        institutions.forEach(inst => {
            const option = document.createElement('option');
            option.value = inst;
            option.textContent = inst;
            fragment.appendChild(option);
        });
        filterSelect.appendChild(fragment);
    };

    const filterSchedules = () => {
        // Dapatkan nilai filter saat ini
        const searchTerm = elements.searchInput.value.toLowerCase().trim();
        const selectedInstitution = elements.institutionFilter.value;

        // Filter data jadwal
        const filtered = allSchedules.filter(item => {
            const searchableText = [
                item.Institusi,
                item.Mata_Pelajaran,
                item.Peserta.join(' ')
            ].join(' ').toLowerCase();
            const matchesSearch = searchTerm === '' || searchableText.includes(searchTerm);
            const matchesInstitution = selectedInstitution === 'all' || item.Institusi === selectedInstitution;
            return matchesSearch && matchesInstitution;
        });

        renderSchedules(filtered); // Render ulang jadwal
    };

    // Fungsi Debounce untuk input pencarian
    const debounce = (func, wait) => {
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(searchDebounceTimeout);
                func.apply(this, args);
            };
            clearTimeout(searchDebounceTimeout);
            searchDebounceTimeout = setTimeout(later, wait);
        };
    };

    // Listener untuk input pencarian (tetap ada, dipicu saat mengetik di input yg muncul)
    elements.searchInput.addEventListener('input', debounce(filterSchedules, 300));
    // Listener untuk filter institusi
    elements.institutionFilter.addEventListener('change', filterSchedules);


    // ======================
    // RENDER TAMPILAN
    // ======================
    const renderSchedules = (data) => {
        elements.scheduleGrid.innerHTML = ''; // Kosongkan grid

        if (data.length === 0 && !elements.loading.classList.contains('active')) { // Cek loading juga
            // Jika tidak ada data & tidak sedang loading, tampilkan pesan kosong
            showEmptyState();
            elements.scheduleGrid.style.display = 'none';
        } else {
            // Jika ada data atau sedang loading, sembunyikan pesan kosong
            hideEmptyState();
            elements.scheduleGrid.style.display = 'grid'; // Tampilkan grid

            // Render kartu jadwal
            const fragment = document.createDocumentFragment();
            data.forEach(item => {
                const card = createScheduleCard(item);
                fragment.appendChild(card);
            });
            elements.scheduleGrid.appendChild(fragment);
        }
    };

    // Membuat elemen HTML untuk satu kartu jadwal
    const createScheduleCard = (item) => {
        const card = document.createElement('article');
        card.className = 'schedule-card';
        // Gunakan data-* attribute untuk menyimpan nilai asli
        card.innerHTML = `
            <div class="card-header">
                <h3 class="course-title clickable" data-entity-type="Mata_Pelajaran" data-entity-value="${item.Mata_Pelajaran}">${item.Mata_Pelajaran}</h3>
                <span class="date-display clickable" data-entity-type="Tanggal" data-entity-value="${item.Tanggal}">${formatDate(item.TanggalDate)}</span>
            </div>
            <div class="institute clickable" data-entity-type="Institusi" data-entity-value="${item.Institusi}">${item.Institusi}</div>
            <div class="participants">
                ${item.Peserta.map(peserta => `
                    <span class="participant-tag clickable" data-entity-type="Peserta" data-entity-value="${peserta}">${peserta}</span>
                `).join('')}
            </div>
        `;
        return card;
    };

    // ======================
    // SISTEM MODAL
    // ======================
    const showGenericModal = (title, data) => {
        elements.modalTitle.textContent = title;
        elements.modalBody.innerHTML = generateModalContent(data);
        elements.modal.classList.add('active'); // Tampilkan modal
        document.body.style.overflow = 'hidden'; // Cegah scroll background
    };

    const hideModal = () => {
        elements.modal.classList.remove('active'); // Sembunyikan modal
        document.body.style.overflow = ''; // Kembalikan scroll background
    };

    // Membuat konten HTML untuk isi modal
    const generateModalContent = (data) => {
        if (!data || data.length === 0) {
            return '<p class="no-data">Tidak ada data jadwal terkait yang ditemukan.</p>';
        }
        // Urutkan data dalam modal
        const sortedData = data.sort((a, b) => a.TanggalDate - b.TanggalDate);
        return sortedData.map(item => `
            <div class="modal-item">
                <div class="card-header"> <h4 class="course-title">${item.Mata_Pelajaran}</h4> </div>
                <div class="modal-meta">
                    <span class="institute">${item.Institusi}</span>
                    <span class="date-display">${formatDate(item.TanggalDate)}</span>
                </div>
                <div class="participants">
                    ${item.Peserta.map(p => `<span class="participant-tag">${p}</span>`).join('')}
                </div>
            </div>
        `).join('');
    };

    // ======================
    // INTERAKSI SEARCH BARU
    // ======================
    const toggleSearchInput = (event) => {
        event.stopPropagation(); // Hentikan propagasi agar tidak trigger closeSearch
        elements.searchArea.classList.toggle('active');
        if (elements.searchArea.classList.contains('active')) {
            elements.searchInput.focus(); // Fokus ke input saat aktif
        }
    };

    // Menutup input search jika klik di luar area search
    const closeSearchOnClickOutside = (event) => {
        if (!elements.searchArea.contains(event.target) && elements.searchArea.classList.contains('active')) {
            elements.searchArea.classList.remove('active');
        }
    };

    // ======================
    // EVENT HANDLERS (PENANGANAN EVENT)
    // ======================
    // Listener utama (delegasi) pada body
    document.body.addEventListener('click', (e) => {
        const target = e.target;

        // Klik pada elemen clickable di kartu (delegasi)
        const clickableCardElement = target.closest('.clickable[data-entity-type]');
        if (clickableCardElement) {
            handleEntityClick(clickableCardElement);
        }

        // Klik pada overlay modal atau tombol close modal
        if (target === elements.modalOverlay || target === elements.closeModalBtn || target.closest('.close-modal')) {
             hideModal();
        }

        // Panggil fungsi close search jika klik di luar area search
        closeSearchOnClickOutside(e);
    });

     // Handler untuk klik pada elemen kartu
    const handleEntityClick = (element) => {
        const entityType = element.dataset.entityType;
        const value = element.dataset.entityValue; // Ambil nilai dari data-*
        let modalTitlePrefix = '';
        let filteredData;

        // Filter data berdasarkan entitas yang diklik
        switch (entityType) {
            case 'Peserta':
                filteredData = allSchedules.filter(item => item.Peserta.includes(value));
                modalTitlePrefix = `Jadwal untuk ${value}`;
                break;
            case 'Tanggal':
                const clickedDate = new Date(value); // Konversi nilai tanggal string ke Date
                clickedDate.setHours(0,0,0,0);
                filteredData = allSchedules.filter(item => {
                    const itemDate = new Date(item.TanggalDate); // Bandingkan dengan TanggalDate
                    itemDate.setHours(0,0,0,0);
                    return itemDate.getTime() === clickedDate.getTime();
                });
                modalTitlePrefix = `Jadwal pada ${formatDate(clickedDate)}`;
                break;
            case 'Mata_Pelajaran':
            case 'Institusi':
            default:
                filteredData = allSchedules.filter(item => item[entityType] === value);
                modalTitlePrefix = `Jadwal ${value}`;
                break;
        }

        // Filter lagi untuk hanya menampilkan jadwal mendatang di modal
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const futureFilteredData = filteredData.filter(item => item.TanggalDate >= today);

        showGenericModal(modalTitlePrefix, futureFilteredData);
    };

    // Listener untuk tombol tema
    elements.themeToggleBtn.addEventListener('click', toggleTheme);

    // Listener untuk tombol search toggle BARU
    elements.searchToggleBtn.addEventListener('click', toggleSearchInput);

    // Listener untuk menutup modal/search dengan tombol Escape
     window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (elements.modal.classList.contains('active')) {
                hideModal();
            } else if (elements.searchArea.classList.contains('active')) {
                 elements.searchArea.classList.remove('active');
            }
        }
    });

    // ======================
    // UTILITAS (FUNGSI BANTU)
    // ======================
    const formatDate = (date) => {
        if (!(date instanceof Date) || isNaN(date.getTime())) return 'Tanggal tidak valid';
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const inputDateOnly = new Date(date); inputDateOnly.setHours(0, 0, 0, 0);
        const options = { weekday: 'long', day: 'numeric', month: 'long', year: (inputDateOnly.getFullYear() !== today.getFullYear()) ? 'numeric' : undefined };
        return inputDateOnly.toLocaleDateString('id-ID', options);
    };

    const showLoading = () => { elements.loading.classList.add('active'); elements.loading.classList.remove('hidden'); };
    const hideLoading = () => { elements.loading.classList.remove('active'); elements.loading.classList.add('hidden'); };
    const showEmptyState = () => { elements.emptyState.classList.add('active'); elements.emptyState.classList.remove('hidden'); /* Isi HTML dipindah ke sini jika perlu diubah */ };
    const hideEmptyState = () => { elements.emptyState.classList.remove('active'); elements.emptyState.classList.add('hidden'); };
    const showError = (message = 'Terjadi kesalahan.') => {
        hideLoading();
        elements.scheduleGrid.style.display = 'none';
        elements.emptyState.classList.add('active');
        elements.emptyState.classList.remove('hidden');
        elements.emptyState.innerHTML = `
            <i class="fas fa-exclamation-triangle empty-icon" style="color: #e74c3c;"></i>
            <h3>Terjadi Kesalahan</h3>
            <p>${message}</p>
        `;
    };

    // ======================
    // INISIALISASI APLIKASI
    // ======================
    initTheme(); // Set tema awal
    fetchData(); // Ambil data jadwal

}); // Akhir dari DOMContentLoaded
