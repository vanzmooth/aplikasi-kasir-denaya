// =======================================================
// MANAJEMEN STOK & PRODUK - VERSI FINAL LENGKAP
// =======================================================

// --- Pembungkus Utama: Jalankan kode setelah semua elemen HTML siap ---
document.addEventListener('DOMContentLoaded', () => {

    // --- KONFIGURASI FIREBASE ---
    const firebaseConfig = {
        apiKey: "AIzaSyD0Qh1Fimh9iYT8dOi91beIbc1wDe80R0g",
        authDomain: "aplikasikasirpwa.firebaseapp.com",
        projectId: "aplikasikasirpwa",
        storageBucket: "aplikasikasirpwa.firebasestorage.app",
        messagingSenderId: "820452190086",
        appId: "1:820452190086:web:695af51a9d5ac707e22e07"
    };

    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();
    const auth = firebase.auth();

    // --- ELEMEN DOM ---
    const stockListContainer = document.getElementById('stock-list-container');
    const addProductForm = document.getElementById('add-product-form');
    const productListAdmin = document.getElementById('product-list-admin');
    const editProductOverlay = document.getElementById('edit-product-overlay');
    const editProductForm = document.getElementById('edit-product-form');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const stockIdSelect = document.getElementById('product-stock-id');
    const logoutButton = document.getElementById('logout-button');

    // --- PENJAGA OTENTIKASI HALAMAN ---
    auth.onAuthStateChanged(user => {
        if (user) {
            document.body.classList.add('visible');
            console.log("Pengguna sudah login, menjalankan semua fungsi.");
            initializeApp();
        } else {
            console.log("Tidak ada pengguna yang login, mengarahkan ke halaman login...");
            window.location.href = 'login.html';
        }
    });

    // --- FUNGSI-FUNGSI ---

    function formatRupiah(number) {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number);
    }

    function listenForStockUpdates() {
        const stockRef = db.collection('counters').doc('stock_tracker');
        stockRef.onSnapshot(doc => {
            if (!doc.exists) {
                stockListContainer.innerHTML = '<p class="loading-text">Dokumen stok tidak ditemukan.</p>';
                return;
            }
            const stockData = doc.data();
            stockListContainer.innerHTML = '';
            for (const stockId in stockData) {
                // Hanya tampilkan field yang relevan, bukan field tanggal
                if (!stockId.toLowerCase().includes('date')) {
                    const displayName = stockId.replace(/_/g, ' ');
                    const stockItem = document.createElement('div');
                    stockItem.className = 'stock-item';
                    stockItem.innerHTML = `
                        <div class="stock-info">
                            <span class="stock-name">${displayName}</span>
                            <span class="stock-quantity">${stockData[stockId]}</span>
                        </div>
                        <div class="stock-actions">
                            <button class="btn-adjust" data-stockid="${stockId}">- Sesuaikan</button>
                            <button class="btn-add" data-stockid="${stockId}">+ Tambah</button>
                        </div>`;
                    stockListContainer.appendChild(stockItem);
                }
            }
        }, error => {
            console.error("Gagal mendengarkan update stok: ", error);
            stockListContainer.innerHTML = '<p class="loading-text">Gagal memuat data stok.</p>';
        });
    }

    function listenForStockHistory() {
        const historyBody = document.getElementById('stock-history-body');
        if (!historyBody) return;
        db.collection('stock_history').orderBy('timestamp', 'desc').limit(50).onSnapshot(snapshot => {
            historyBody.innerHTML = '';
            if (snapshot.empty) {
                historyBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Belum ada riwayat.</td></tr>';
                return;
            }
            snapshot.docs.forEach(doc => {
                const log = doc.data();
                const logDate = log.timestamp ? log.timestamp.toDate().toLocaleString('id-ID') : 'N/A';
                const changeAmount = log.change > 0 ? `+${log.change}` : log.change;
                const changeClass = log.change > 0 ? 'stock-in' : 'stock-out';
                const row = document.createElement('tr');
                row.innerHTML = `<td>${logDate}</td><td>${log.stock_id.replace(/_/g, ' ')}</td><td><span class="stock-change ${changeClass}">${changeAmount}</span></td><td>${log.reason}</td>`;
                historyBody.appendChild(row);
            });
        }, error => {
            console.error("Gagal memuat riwayat stok:", error);
            historyBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Gagal memuat riwayat.</td></tr>';
        });
    }

    async function populateStockIdDropdown(selectElementId) {
        const selectEl = document.getElementById(selectElementId);
        if (!selectEl) return;
        const firstOption = selectEl.options[0];
        selectEl.innerHTML = '';
        if (firstOption) selectEl.appendChild(firstOption);
        try {
            const doc = await db.collection('counters').doc('stock_tracker').get();
            if (doc.exists) {
                const stockData = doc.data();
                for (const stockId in stockData) {
                    if (!stockId.toLowerCase().includes('date')) {
                        const option = document.createElement('option');
                        option.value = stockId;
                        option.textContent = stockId.replace(/_/g, ' ');
                        selectEl.appendChild(option);
                    }
                }
            }
        } catch (error) { console.error("Gagal mengisi dropdown stok:", error); }
        if (selectElementId === 'product-stock-id') {
            const addNewOption = document.createElement('option');
            addNewOption.value = '--add_new--';
            addNewOption.textContent = '++ Tambah Kategori Baru ++';
            selectEl.appendChild(addNewOption);
        }
    }

    function listenForProducts() {
        db.collection('products').orderBy('name').onSnapshot(snapshot => {
            productListAdmin.innerHTML = '';
            if (snapshot.empty) {
                productListAdmin.innerHTML = '<p>Belum ada menu yang ditambahkan.</p>';
                return;
            }
            snapshot.forEach(doc => {
                const product = { id: doc.id, ...doc.data() };
                const productItem = document.createElement('div');
                productItem.className = 'product-list-item';
                productItem.innerHTML = `<img src="${product.image || 'https://placehold.co/100x100?text=?'}" alt="${product.name}"><div class="product-list-info"><div class="name">${product.name}</div><div class="details">${formatRupiah(product.price)} | Stok: ${product.stock_id.replace(/_/g, ' ')}</div></div><button class="btn-edit" data-id="${product.id}">Edit</button>`;
                productListAdmin.appendChild(productItem);
            });
        }, error => console.error("Gagal memuat daftar produk:", error));
    }

    async function handleAddNewStockCategory() {
        const newCategoryName = prompt("Masukkan nama untuk kategori stok baru (misal: Minuman Dingin):");
        if (!newCategoryName || newCategoryName.trim() === '') { alert("Nama kategori tidak boleh kosong."); stockIdSelect.value = ""; return; }
        const initialStockStr = prompt(`Masukkan jumlah stok awal untuk "${newCategoryName}":`);
        const initialStock = parseInt(initialStockStr);
        if (isNaN(initialStock) || initialStock < 0) { alert("Harap masukkan jumlah stok yang valid."); stockIdSelect.value = ""; return; }
        const newStockId = `${newCategoryName.trim().toLowerCase().replace(/\s+/g, '_')}`;
        try {
            const stockRef = db.collection('counters').doc('stock_tracker');
            await stockRef.update({ [newStockId]: initialStock });
            alert(`Kategori stok "${newCategoryName}" berhasil dibuat!`);
            await populateStockIdDropdown('product-stock-id');
            await populateStockIdDropdown('edit-product-stock-id');
            stockIdSelect.value = newStockId;
        } catch (error) { alert(`Gagal membuat kategori stok baru: ${error.message}`); stockIdSelect.value = ""; }
    }

    // --- EVENT LISTENERS ---
    if (logoutButton) {
        logoutButton.addEventListener('click', () => { auth.signOut().catch((error) => { console.error('Error saat logout:', error); }); });
    }

    if (addProductForm) {
        addProductForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const saveButton = document.getElementById('save-product-btn');
            saveButton.disabled = true; saveButton.textContent = 'Menyimpan...';
            try {
                const newProduct = {
                    name: document.getElementById('product-name').value,
                    price: parseInt(document.getElementById('product-price').value),
                    image: document.getElementById('product-image').value || '',
                    stock_id: document.getElementById('product-stock-id').value,
                    min_order: parseInt(document.getElementById('product-min-order').value) || 1
                };
                if (!newProduct.name || !newProduct.price || !newProduct.stock_id) throw new Error('Nama, Harga, dan Kategori Stok wajib diisi.');
                await db.collection('products').add(newProduct);
                alert(`Menu "${newProduct.name}" berhasil ditambahkan!`);
                addProductForm.reset();
            } catch (error) { alert(`Gagal menambah menu: ${error.message}`); }
            finally { saveButton.disabled = false; saveButton.textContent = 'Simpan Menu'; }
        });
    }

    if (stockIdSelect) {
        stockIdSelect.addEventListener('change', (event) => { if (event.target.value === '--add_new--') handleAddNewStockCategory(); });
    }

    if (productListAdmin) {
        productListAdmin.addEventListener('click', async (event) => {
            if (event.target.classList.contains('btn-edit')) {
                const productId = event.target.dataset.id;
                try {
                    const doc = await db.collection('products').doc(productId).get();
                    if (doc.exists) {
                        const product = doc.data();
                        document.getElementById('edit-product-id').value = productId;
                        document.getElementById('edit-product-name').value = product.name;
                        document.getElementById('edit-product-price').value = product.price;
                        document.getElementById('edit-product-image').value = product.image || '';
                        document.getElementById('edit-product-min-order').value = product.min_order || '';
                        await populateStockIdDropdown('edit-product-stock-id');
                        document.getElementById('edit-product-stock-id').value = product.stock_id;
                        editProductOverlay.classList.remove('hidden');
                    }
                } catch (error) { alert('Gagal mengambil data produk.'); }
            }
        });
    }

    if (editProductForm) {
        editProductForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const saveButton = document.getElementById('save-changes-btn');
            saveButton.disabled = true; saveButton.textContent = 'Menyimpan...';
            const productId = document.getElementById('edit-product-id').value;
            try {
                const updatedProduct = {
                    name: document.getElementById('edit-product-name').value,
                    price: parseInt(document.getElementById('edit-product-price').value),
                    image: document.getElementById('edit-product-image').value || '',
                    stock_id: document.getElementById('edit-product-stock-id').value,
                    min_order: parseInt(document.getElementById('edit-product-min-order').value) || 1
                };
                await db.collection('products').doc(productId).update(updatedProduct);
                alert('Perubahan berhasil disimpan!');
                editProductOverlay.classList.add('hidden');
            } catch (error) { alert('Gagal menyimpan perubahan.'); }
            finally { saveButton.disabled = false; saveButton.textContent = 'Simpan Perubahan'; }
        });
    }

    if (cancelEditBtn) cancelEditBtn.addEventListener('click', () => { editProductOverlay.classList.add('hidden'); });

    if (stockListContainer) {
        stockListContainer.addEventListener('click', async (event) => {
            const target = event.target;
            const stockId = target.dataset.stockid;
            if (!stockId) return;
            let amount = 0; let reason = '';
            if (target.classList.contains('btn-add')) {
                const amountStr = prompt(`Jumlah stok masuk untuk ${stockId.replace(/_/g, ' ')}:`);
                if (!amountStr) return; amount = parseInt(amountStr); reason = "Stok Masuk (Manual)";
            } else if (target.classList.contains('btn-adjust')) {
                const amountStr = prompt(`Jumlah stok keluar/rusak untuk ${stockId.replace(/_/g, ' ')}:`);
                if (!amountStr) return; amount = -Math.abs(parseInt(amountStr));
                reason = prompt("Alasan penyesuaian (contoh: Rusak):", "Rusak/Terbuang");
                if (!reason) return;
            }
            if (isNaN(amount) || amount === 0) { alert("Harap masukkan jumlah yang valid."); return; }
            try {
                target.disabled = true;
                const stockRef = db.collection('counters').doc('stock_tracker');
                const historyRef = db.collection('stock_history').doc();
                const batch = db.batch();
                batch.update(stockRef, { [stockId]: firebase.firestore.FieldValue.increment(amount) });
                batch.set(historyRef, { stock_id: stockId, change: amount, reason: reason, timestamp: firebase.firestore.FieldValue.serverTimestamp() });
                await batch.commit();
                alert('Stok berhasil diperbarui!');
            } catch (error) { alert(`Gagal memperbarui stok: ${error.message}`); }
            finally { target.disabled = false; }
        });
    }

    // --- INISIALISASI APLIKASI ---
    async function initializeApp() {
        listenForStockUpdates();
        listenForStockHistory();
        populateStockIdDropdown('product-stock-id');
        listenForProducts();
    }
});