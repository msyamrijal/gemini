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
    themeToggleBtn: document.getElementById('themeToggle')
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
};

const toggleTheme = () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
};

const updateThemeIcon = (theme) => {
    const themeIcon = elements.themeToggleBtn.querySelector('.theme-icon');
    // Style changes handled by CSS based on data-theme attribute
    // Optional: Add class for animation control if needed
    // themeIcon.style.transform = theme === 'dark' ? 'rotate(40deg)' : 'rotate(0deg)'; // Handled by CSS now
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
        today.setHours(0, 0, 0, 0); // Set to beginning of today

        // Process and sort data
        allSchedules = data
            .filter(item => {
                // Basic validation: Ensure essential fields exist and date is valid
                return item.Tanggal && item.Institusi && item.Mata_Pelajaran && item.Peserta && !isNaN(new Date(item.Tanggal).getTime());
            })
            .map(item => ({ ...item, TanggalDate: new Date(item.Tanggal) })) // Pre-convert date for sorting/filtering
            .filter(item => item.TanggalDate >= today)
            .sort((a, b) => a.TanggalDate - b.TanggalDate);

        initFilters();
        filterSchedules(); // Initial render based on default filters
        attachDynamicListeners();

    } catch (error) {
        console.error('Fetch Error:', error);
        showError('Gagal memuat data jadwal. Periksa koneksi Anda atau coba lagi nanti.');
    } finally {
        hideLoading();
        initialLoad = false; // Mark initial load as complete
    }
};

// ======================
// FILTER SYSTEM
// ======================
const initFilters = () => {
    // Use a Set for unique institutions and sort them alphabetically
    const institutions = [...new Set(allSchedules.map(item => item.Institusi))].sort((a, b) => a.localeCompare(b));
    const filterSelect = elements.institutionFilter;

    // Clear existing options (except the default "Semua Institusi")
    filterSelect.length = 1; // Keep the first option

    // Add new options
    institutions.forEach(inst => {
        const option = document.createElement('option');
        option.value = inst;
        option.textContent = inst;
        filterSelect.appendChild(option);
    });

    // Add event listeners only once
    if (!filterSelect.dataset.listenerAttached) {
        elements.searchInput.addEventListener('input', debounce(filterSchedules, 300)); // Debounce search input
        filterSelect.addEventListener('change', filterSchedules);
        filterSelect.dataset.listenerAttached = 'true';
    }
};

const filterSchedules = () => {
    const searchTerm = elements.searchInput.value.toLowerCase().trim();
    const selectedInstitution = elements.institutionFilter.value;

    const filtered = allSchedules.filter(item => {
        // Combine relevant fields into a single string for searching
        const searchableText = [
            item.Institusi,
            item.Mata_Pelajaran,
            item.Peserta.join(' ')
            // Optionally add formatted date if needed for search
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
    elements.scheduleGrid.innerHTML = ''; // Clear previous results

    if (data.length === 0) {
        showEmptyState();
        hideLoading(); // Ensure loading is hidden
        return;
    }

    hideEmptyState();
    hideLoading(); // Ensure loading is hidden

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
    card.innerHTML = `
        <div class="card-header">
            <h3 class="course-title clickable" data-entity="Mata_Pelajaran">${item.Mata_Pelajaran}</h3>
            <span class="date-display clickable" data-entity="Tanggal">${formatDate(item.Tanggal)}</span>
        </div>
        <div class="institute clickable" data-entity="Institusi">${item.Institusi}</div>
        <div class="participants">
            ${item.Peserta.map(peserta => `
                <span class="participant-tag clickable" data-entity="Peserta">${peserta}</span>
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
    elements.modal.style.display = 'block'; // Show modal
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
    // Focus management could be added here for accessibility
};

const hideModal = () => {
    elements.modal.style.display = 'none';
    document.body.style.overflow = ''; // Restore background scrolling
};

const generateModalContent = (data) => {
    if (!data || data.length === 0) {
        return '<p class="no-data">Tidak ada data jadwal terkait yang ditemukan.</p>';
    }

    return data.map(item => `
        <div class="modal-item">
            <div class="card-header">
                <h4 class="course-title">${item.Mata_Pelajaran}</h4>
            </div>
             <div class="modal-meta">
                <span class="institute">${item.Institusi}</span>
                <span class="date-display">${formatDate(item.Tanggal)}</span>
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
    const value = element.textContent;
    let filterProperty = entityType;
    let modalTitlePrefix = '';

    // Prepare data based on clicked entity
    let filteredData;
    if (entityType === 'Peserta') {
        filteredData = allSchedules.filter(item => item.Peserta.includes(value));
        modalTitlePrefix = `Jadwal untuk ${value}`;
    } else if (entityType === 'Tanggal') {
        // Match by formatted date string if needed, or re-filter by date object
         const clickedDateStr = formatDate(value); // Assuming value is a parseable date string initially
         filteredData = allSchedules.filter(item => formatDate(item.Tanggal) === clickedDateStr);
         modalTitlePrefix = `Jadwal pada ${value}`;
    }
     else { // Mata_Pelajaran or Institusi
        filteredData = allSchedules.filter(item => item[filterProperty] === value);
        modalTitlePrefix = `Jadwal ${value}`;
    }

    // Filter out past schedules for the modal view as well (optional, depends on desired behavior)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const futureFilteredData = filteredData.filter(item => item.TanggalDate >= today);


    showGenericModal(modalTitlePrefix, futureFilteredData);
};


// Use event delegation for dynamically added elements
const attachDynamicListeners = () => {
    document.body.addEventListener('click', (e) => {
        const target = e.target;

        // Handle clicks on clickable entities within cards or modal
        if (target.classList.contains('clickable') && target.dataset.entity) {
            handleEntityClick(target);
        }

        // Close modal logic
        if (target === elements.modalOverlay || target === elements.closeModalBtn || target.closest('.close-modal')) {
             hideModal();
        }
    });
};

// ======================
// UTILITIES
// ======================
const formatDate = (dateString) => {
    // Check if dateString is already a Date object (from processing)
    const date = (dateString instanceof Date) ? dateString : new Date(dateString);

    if (isNaN(date.getTime())) {
        return 'Tanggal tidak valid'; // Handle invalid date strings
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const inputDateOnly = new Date(date);
    inputDateOnly.setHours(0, 0, 0, 0);

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
    elements.loading.style.display = 'flex'; // Ensure display is correct
    elements.emptyState.classList.add('hidden');
    elements.scheduleGrid.style.display = 'none'; // Hide grid while loading
};

const hideLoading = () => {
    elements.loading.classList.add('hidden');
     elements.loading.style.display = 'none';
     elements.scheduleGrid.style.display = 'grid'; // Show grid again
};

const showEmptyState = () => {
    elements.emptyState.classList.remove('hidden');
    elements.emptyState.style.display = 'flex'; // Ensure display is correct
    elements.scheduleGrid.style.display = 'none'; // Hide grid
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
    elements.scheduleGrid.style.display = 'none'; // Hide grid on error
    elements.emptyState.classList.remove('hidden');
    elements.emptyState.style.display = 'flex';
    elements.emptyState.innerHTML = `
        <i class="fas fa-exclamation-triangle empty-icon" style="color: #e74c3c;"></i>
        <h3>Terjadi Kesalahan</h3>
        <p>${message}</p>
    `;
};

// Debounce function to limit frequency of function calls (e.g., on search input)
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
    initTheme();
    fetchData(); // Fetch data after DOM is loaded

    // Static event listeners
    elements.themeToggleBtn.addEventListener('click', toggleTheme);

    // Modal closing listeners (already handled by delegation in attachDynamicListeners)
    // elements.closeModalBtn.addEventListener('click', hideModal);
    // elements.modalOverlay.addEventListener('click', hideModal); // Click outside modal content

    // Close modal with Escape key
     window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && elements.modal.style.display === 'block') {
            hideModal();
        }
    });
});
