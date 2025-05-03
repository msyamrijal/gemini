// app.js
document.addEventListener('DOMContentLoaded', () => {
    // URL API Google Apps Script
    const API_URL = 'https://script.google.com/macros/s/AKfycby9sPywic_2ifeYBzE3dQMHfrwkR4-fQv-bNx74HMduvcq5Rr4r9MY6GGEYNqI44WRI/exec';

    // Elemen DOM yang sering digunakan
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
                // Tangani jika request API gagal
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();

            const today = new Date();
            today.setHours(0, 0, 0, 0); // Set ke awal hari ini

            // Proses dan filter data:
            // 1. Pastikan field penting ada dan tanggal valid
            // 2. Konversi tanggal string ke objek Date untuk sorting/filtering
            // 3. Filter jadwal yang sudah lewat
            // 4. Urutkan berdasarkan tanggal terdekat
            allSchedules = data
                .filter(item =>
                    item.Tanggal && item.Institusi && item.Mata_Pelajaran && Array.isArray(item.Peserta) && !isNaN(new Date(item.Tanggal).getTime())
                )
                .map(item => ({ ...item, TanggalDate: new Date(item.Tanggal) }))
                .filter(item => item.TanggalDate >= today)
                .sort((a, b) => a.TanggalDate - b.TanggalDate);

            initFilters(); // Inisialisasi opsi filter institusi
            filterSchedules(); // Render jadwal awal berdasarkan filter default

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

        // Kosongkan opsi lama (kecuali opsi default "Semua Institusi")
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
            // Gabungkan teks yang relevan untuk pencarian
            const searchableText = [
                item.Institusi,
                item.Mata_Pelajaran,
                item.Peserta.join(' ')
            ].join(' ').toLowerCase();

            // Cek kecocokan dengan kata kunci pencarian
            const matchesSearch = searchTerm === '' || searchableText.includes(searchTerm);
            // Cek kecocokan dengan filter institusi
            const matchesInstitution = selectedInstitution === 'all' || item.Institusi === selectedInstitution;

            return matchesSearch && matchesInstitution;
        });

        renderSchedules(filtered); // Render ulang jadwal dengan data terfilter
    };

    // Fungsi Debounce untuk membatasi frekuensi pemanggilan filter saat mengetik
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

    // Event listener untuk input pencarian dengan debounce
    elements.searchInput.addEventListener('input', debounce(filterSchedules, 300));
    // Event listener untuk perubahan filter institusi
    elements.institutionFilter.addEventListener('change', filterSchedules);


    // ======================
    // RENDER TAMPILAN
    // ======================
    const renderSchedules = (data) => {
        elements.scheduleGrid.innerHTML = ''; // Kosongkan grid

        if (data.length === 0) {
            // Jika tidak ada data, tampilkan pesan kosong
            showEmptyState();
            hideLoading();
            elements.scheduleGrid.style.display = 'none'; // Sembunyikan grid
        } else {
            // Jika ada data, tampilkan grid dan sembunyikan pesan kosong/loading
            hideEmptyState();
            hideLoading();
            elements.scheduleGrid.style.display = 'grid'; // Tampilkan grid

            // Gunakan DocumentFragment untuk efisiensi DOM manipulation
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
        // Tambahkan data-* attribute untuk identifikasi saat diklik
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
        elements.modal.classList.add('active'); // Tampilkan modal dengan class 'active'
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

        // Urutkan data dalam modal berdasarkan tanggal (jika belum terurut)
        const sortedData = data.sort((a, b) => a.TanggalDate - b.TanggalDate);

        return sortedData.map(item => `
            <div class="modal-item">
                <div class="card-header">
                    <h4 class="course-title">${item.Mata_Pelajaran}</h4>
                </div>
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
    // EVENT HANDLERS (PENANGANAN EVENT)
    // ======================

    // Menggunakan event delegation pada body untuk menangani klik pada elemen dinamis
    document.body.addEventListener('click', (e) => {
        const target = e.target;

        // Klik pada elemen yang bisa diklik di kartu (mata kuliah, tanggal, institusi, peserta)
        if (target.classList.contains('clickable') && target.dataset.entityType) {
            handleEntityClick(target);
        }

        // Klik pada overlay modal atau tombol close
        if (target === elements.modalOverlay || target === elements.closeModalBtn || target.closest('.close-modal')) {
             hideModal();
        }
    });

    // Menangani klik pada entitas (mata kuliah, tanggal, dll.)
    const handleEntityClick = (element) => {
        const entityType = element.dataset.entityType;
        const value = element.dataset.entityValue;
        let modalTitlePrefix = '';
        let filteredData;

        // Filter data berdasarkan entitas yang diklik
        switch (entityType) {
            case 'Peserta':
                filteredData = allSchedules.filter(item => item.Peserta.includes(value));
                modalTitlePrefix = `Jadwal untuk ${value}`;
                break;
            case 'Tanggal':
                 // Filter berdasarkan tanggal asli (bukan string format)
                const clickedDate = new Date(value);
                clickedDate.setHours(0,0,0,0);
                filteredData = allSchedules.filter(item => {
                    const itemDate = new Date(item.TanggalDate);
                    itemDate.setHours(0,0,0,0);
                    return itemDate.getTime() === clickedDate.getTime();
                });
                modalTitlePrefix = `Jadwal pada ${formatDate(clickedDate)}`; // Gunakan tanggal format untuk judul
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

    // Listener untuk menutup modal dengan tombol Escape
     window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && elements.modal.classList.contains('active')) {
            hideModal();
        }
    });

    // ======================
    // UTILITAS (FUNGSI BANTU)
    // ======================
    const formatDate = (date) => {
        // Terima objek Date secara langsung
        if (!(date instanceof Date) || isNaN(date.getTime())) {
            return 'Tanggal tidak valid';
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const inputDateOnly = new Date(date);
        inputDateOnly.setHours(0, 0, 0, 0);

        // Opsi format tanggal Indonesia
        const options = {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: (inputDateOnly.getFullYear() !== today.getFullYear()) ? 'numeric' : undefined
        };
        return inputDateOnly.toLocaleDateString('id-ID', options);
    };

    // Menampilkan/menyembunyikan indikator loading
    const showLoading = () => {
        elements.loading.classList.add('active');
        elements.loading.classList.remove('hidden'); // Pastikan tidak hidden
    };
    const hideLoading = () => {
        elements.loading.classList.remove('active');
        elements.loading.classList.add('hidden'); // Tambahkan hidden untuk kepastian
    };

    // Menampilkan/menyembunyikan pesan state kosong
    const showEmptyState = () => {
        elements.emptyState.classList.add('active');
         elements.emptyState.classList.remove('hidden');
        elements.emptyState.innerHTML = `
            <i class="fas fa-ghost empty-icon"></i>
            <h3>Oops! Jadwal tidak ditemukan</h3>
            <p>Coba kata kunci atau filter yang berbeda.</p>
        `;
    };
     const hideEmptyState = () => {
        elements.emptyState.classList.remove('active');
        elements.emptyState.classList.add('hidden');
    };

    // Menampilkan pesan error
    const showError = (message = 'Terjadi kesalahan.') => {
        hideLoading();
        elements.scheduleGrid.style.display = 'none'; // Sembunyikan grid saat error
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
    initTheme(); // Set tema awal saat load
    fetchData(); // Ambil data jadwal

}); // Akhir dari DOMContentLoaded
