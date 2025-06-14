// Membungkus semua kode untuk memastikan HTML sudah siap
document.addEventListener('DOMContentLoaded', () => {

    // =======================================================
    // HALAMAN MENU PELANGGAN - VERSI FINAL DENGAN SAKLAR PEMBAYARAN
    // =======================================================

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
    const functions = firebase.functions(); // Inisialisasi layanan Functions

    // --- VARIABEL GLOBAL ---
    const CART_STORAGE_KEY = 'customerCart';
    let cart = JSON.parse(localStorage.getItem(CART_STORAGE_KEY)) || [];
    let products = [];
    let inventory = {};
    let activePaymentMethod = 'manual'; // Default ke manual, akan di-update dari Firestore
    let finalUniqueTotal = 0;

    // --- ELEMEN DOM ---
    const productListEl = document.getElementById('product-list');
    const cartItemsEl = document.getElementById('cart-items');
    const totalPriceEl = document.getElementById('total-price');
    const checkoutButton = document.getElementById('checkout-button');
    const paymentOverlay = document.getElementById('payment-overlay');
    const confirmPaymentButton = document.getElementById('confirm-payment-button');
    const cancelPaymentButton = document.getElementById('cancel-payment-button');

    // GANTI BLOK LOGIKA WELCOME OVERLAY LAMA ANDA DENGAN INI
    // ===============================================
    // --- LOGIKA BARU UNTUK OVERLAY SELAMAT DATANG ---
    // ===============================================
    const welcomeOverlay = document.getElementById('welcome-overlay');
    const closeWelcomeBtn = document.getElementById('close-welcome-btn');
    const infoButton = document.getElementById('info-button');

    // Cek apakah pengguna sudah pernah berkunjung
    if (!localStorage.getItem('hasVisitedDenaya')) {
        // Jika BELUM, tampilkan overlay dengan menghapus kelas 'hidden'
        welcomeOverlay.classList.remove('hidden');
    }

    // Listener untuk tombol tutup di overlay
    closeWelcomeBtn.addEventListener('click', () => {
        // Sembunyikan overlay dengan menambahkan kembali kelas 'hidden'
        welcomeOverlay.classList.add('hidden');
        // Tandai bahwa pengguna sudah pernah berkunjung
        localStorage.setItem('hasVisitedDenaya', 'true');
    });

    // Listener untuk tombol info (i) di header
    infoButton.addEventListener('click', () => {
        // Tampilkan kembali overlay dengan menghapus kelas 'hidden'
        welcomeOverlay.classList.remove('hidden');
    });
    // --- AKHIR LOGIKA BARU ---

    // --- FUNGSI-FUNGSI HELPER (Tidak ada perubahan) ---
    function formatRupiah(number) { return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number); }
    async function fetchInventory() { try { const doc = await db.collection('counters').doc('stock_tracker').get(); if (doc.exists) { inventory = doc.data(); } } catch (error) { console.error("Gagal memuat stok:", error); } }
    async function fetchProducts() { productListEl.innerHTML = '<p>Memuat menu...</p>'; try { const snapshot = await db.collection('products').get(); if (snapshot.empty) { productListEl.innerHTML = '<p>Menu belum tersedia.</p>'; return; } products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); renderProducts(); } catch (error) { productListEl.innerHTML = '<p>Gagal memuat menu.</p>'; } }
    function renderProducts() { productListEl.innerHTML = ''; products.forEach(product => { const productCard = document.createElement('div'); productCard.className = 'product-card'; const itemInCart = cart.find(cartItem => cartItem.id === product.id); const quantityInCart = itemInCart ? itemInCart.quantity : 0; if (quantityInCart > 0) productCard.classList.add('in-cart'); let isOutOfStock = (product.stock_id && (inventory[product.stock_id] === undefined || inventory[product.stock_id] <= 0)); if (isOutOfStock) productCard.classList.add('out-of-stock'); productCard.innerHTML = `${quantityInCart > 0 ? `<div class="quantity-badge">${quantityInCart}</div>` : ''}<img src="${product.image || 'https://placehold.co/100x100?text=Produk'}" alt="${product.name}"><div class="product-name">${product.name}</div><div class="product-price">${formatRupiah(product.price)}</div>`; if (!isOutOfStock) { productCard.addEventListener('click', () => addToCart(product.id)); } productListEl.appendChild(productCard); }); }
    function renderCart() { cartItemsEl.innerHTML = ''; if (cart.length === 0) { cartItemsEl.innerHTML = '<p>Pilih jajanan yang kamu suka!</p>'; } else { cart.forEach(item => { const cartItem = document.createElement('div'); cartItem.className = 'cart-item'; cartItem.innerHTML = `<span class="cart-item-name">${item.name}</span><div class="cart-item-controls"><button class="btn-quantity" data-id="${item.id}" data-action="decrease">-</button><input type="number" class="cart-item-quantity" value="${item.quantity}" min="1" data-id="${item.id}"><button class="btn-quantity" data-id="${item.id}" data-action="increase">+</button></div><span class="cart-item-price">${formatRupiah(item.price * item.quantity)}</span><button class="btn-remove" data-id="${item.id}">🗑️</button>`; cartItemsEl.appendChild(cartItem); }); } const totalPrice = cart.reduce((total, item) => total + (item.price * item.quantity), 0); totalPriceEl.textContent = formatRupiah(totalPrice); localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart)); }
    function addToCart(productId, quantityToAdd = 1) { const product = products.find(p => p.id === productId); if (!product || !product.stock_id) { alert("Produk ini tidak memiliki ID Stok."); return; } const stockId = product.stock_id; const stockAvailable = inventory[stockId] || 0; let quantityOfSameStockInCart = 0; cart.forEach(item => { if (item.stock_id === stockId) quantityOfSameStockInCart += item.quantity; }); const existingItem = cart.find(item => item.id === productId); let finalQuantityToAdd = quantityToAdd; if (!existingItem && product.min_order > 1) { if (quantityToAdd === 1) finalQuantityToAdd = product.min_order; } if (quantityOfSameStockInCart + finalQuantityToAdd > stockAvailable) { alert(`Stok untuk kategori ini hanya tersisa ${stockAvailable}.`); return; } if (existingItem) existingItem.quantity += quantityToAdd; else cart.push({ ...product, quantity: finalQuantityToAdd }); renderCart(); renderProducts(); }
    function updateCartItemQuantity(productId, action) { const itemIndex = cart.findIndex(item => item.id === productId); if (itemIndex === -1) return; const item = cart[itemIndex]; const minOrder = item.min_order || 1; if (action === 'increase') { item.quantity++; } else if (action === 'decrease') { if (item.quantity - 1 < minOrder) { alert(`Minimal pembelian untuk ${item.name} adalah ${minOrder} pcs.`); return; } item.quantity--; if (item.quantity <= 0) cart.splice(itemIndex, 1); } renderCart(); renderProducts(); }
    function setCartItemQuantity(productId, newQuantity) { const itemIndex = cart.findIndex(item => item.id === productId); if (itemIndex === -1) return; const item = cart[itemIndex]; const minOrder = item.min_order || 1; const quantity = parseInt(newQuantity); if (isNaN(quantity)) { renderCart(); return; } if (quantity < minOrder) { alert(`Minimal pembelian untuk ${item.name} adalah ${minOrder} pcs.`); if (quantity <= 0 && minOrder <= 1) cart.splice(itemIndex, 1); } else { item.quantity = quantity; } renderCart(); renderProducts(); }
    function removeItemFromCart(productId) { const itemIndex = cart.findIndex(item => item.id === productId); if (itemIndex > -1) { cart.splice(itemIndex, 1); renderCart(); renderProducts(); } }

    // --- FUNGSI BARU UNTUK MENGAMBIL PENGATURAN PEMBAYARAN ---
    async function fetchPaymentSetting() {
        try {
            const doc = await db.collection('settings').doc('payment').get();
            if (doc.exists && doc.data().active_method) {
                activePaymentMethod = doc.data().active_method;
            }
        } catch (error) {
            console.error("Gagal mengambil pengaturan, menggunakan mode manual.", error);
            activePaymentMethod = 'manual';
        }
    }

    // =======================================================
    // --- EVENT LISTENERS ---
    // =======================================================

    // Listener untuk keranjang belanja (+, -, hapus, input manual)
    cartItemsEl.addEventListener('click', (event) => {
        if (event.target.classList.contains('btn-quantity')) updateCartItemQuantity(event.target.dataset.id, event.target.dataset.action);
        if (event.target.classList.contains('btn-remove')) removeItemFromCart(event.target.dataset.id);
    });
    cartItemsEl.addEventListener('change', (event) => { if (event.target.classList.contains('cart-item-quantity')) setCartItemQuantity(event.target.dataset.id, event.target.value); });

    // Listener untuk tombol "Pesan & Bayar Sekarang" (sudah cerdas)
    // Ganti listener checkoutButton lama dengan versi fetch ini
    // Ganti seluruh listener checkoutButton Anda dengan versi debugging ini
    // Ganti listener checkoutButton di menu.js dengan versi ini
    // --- EVENT LISTENER UTAMA UNTUK CHECKOUT ---
    // --- EVENT LISTENER UTAMA UNTUK CHECKOUT ---
    checkoutButton.addEventListener('click', async () => {
        if (cart.length === 0) { alert('Keranjang Anda masih kosong!'); return; }
        const customerName = document.getElementById('customer-name').value.trim();
        if (!customerName) { alert('Harap isi nama Anda.'); return; }

        checkoutButton.disabled = true;
        checkoutButton.textContent = 'Memproses...';

        // Cek mode pembayaran yang aktif
        if (activePaymentMethod === 'otomatis') {
            // ===================================
            // --- ALUR OTOMATIS DENGAN FETCH ---
            // ===================================
            checkoutButton.textContent = 'Menghubungi Server...';
            try {
                const functionUrl = 'https://asia-southeast2-aplikasikasirpwa.cloudfunctions.net/createMidtransTransaction';

                const totalAmount = cart.reduce((total, item) => total + (item.price * item.quantity), 0);
                const orderId = `JAJANAN-${Date.now()}`;

                const payload = {
                    orderId: orderId,
                    totalAmount: totalAmount,
                    customerDetails: { name: customerName },
                    items: cart.map(item => ({ id: item.id, price: item.price, quantity: item.quantity, name: item.name }))
                };

                console.log("Mengirim permintaan FETCH ke Cloud Function...");

                // Lakukan pemanggilan menggunakan FETCH
                const response = await fetch(functionUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    // Backend onRequest kita mengharapkan format { data: ... }
                    body: JSON.stringify({ data: payload })
                });

                const result = await response.json();

                if (!response.ok) {
                    // Jika server merespon dengan error (misal 500 atau 400)
                    throw new Error(result.error.message || 'Terjadi kesalahan di server.');
                }

                const transactionToken = result.data.token;
                if (!transactionToken) {
                    throw new Error('Gagal mendapatkan token pembayaran dari server.');
                }

                // Buka Popup Pembayaran Midtrans Snap
                snap.pay(transactionToken, {
                    // ...DENGAN BLOK INI
                    onSuccess: function (result) {
                        console.log("Pembayaran Midtrans Sukses, menyimpan pesanan:", result);

                        // Siapkan data dengan status 'siap_diproses'
                        const pendingOrderData = {
                            items: cart,
                            totalAmount: totalAmount, // Pastikan variabel ini bisa diakses
                            customerName: customerName, // Pastikan variabel ini bisa diakses
                            status: 'siap_diproses',
                            payment_details: result,
                            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                            originalOrderId: orderId // Pastikan orderId bisa diakses
                        };

                        // Kirim ke 'pending_orders'
                        db.collection('pending_orders').add(pendingOrderData).then(docRef => {
                            // Setelah berhasil disimpan, bersihkan keranjang...
                            cart = [];
                            localStorage.removeItem(CART_STORAGE_KEY);
                            renderCart();
                            renderProducts();

                            // ...LALU ARAHKAN KE HALAMAN STATUS!
                            window.location.href = `status.html?id=${docRef.id}`;
                        });
                    },
                    onClose: () => {
                        checkoutButton.disabled = false;
                        checkoutButton.textContent = 'Pesan & Bayar Sekarang';
                    }
                });

            } catch (error) {
                console.error("Error saat checkout:", error);
                alert(`Gagal: ${error.message}`);
                checkoutButton.disabled = false;
                checkoutButton.textContent = 'Pesan & Bayar Sekarang';
            }
        } else {
            // --- ALUR MANUAL (KODE UNIK) ---
            // (Logika overlay kode unik Anda yang sudah benar ada di sini)
            // ...
            checkoutButton.disabled = false;
            checkoutButton.textContent = 'Pesan & Bayar Sekarang';
        }
    });

    // Listener untuk tombol di dalam overlay (hanya untuk mode manual)
    confirmPaymentButton.addEventListener('click', async () => {
        const customerName = document.getElementById('customer-name').value.trim();
        if (!customerName) { alert('Harap isi nama Anda.'); return; }

        confirmPaymentButton.disabled = true;
        confirmPaymentButton.textContent = 'Memproses...';

        const pendingOrderData = { items: cart, totalAmount: finalUniqueTotal, createdAt: firebase.firestore.FieldValue.serverTimestamp(), status: 'menunggu_validasi', customerName: customerName };
        try {
            const docRef = await db.collection('pending_orders').add(pendingOrderData);
            cart = [];
            localStorage.removeItem(CART_STORAGE_KEY);
            window.location.href = `status.html?id=${docRef.id}`;
        } catch (error) {
            alert("Gagal mengirim pesanan. Coba lagi.");
            confirmPaymentButton.disabled = false;
            confirmPaymentButton.textContent = 'Saya Sudah Bayar & Mengerti';
        }
    });

    cancelPaymentButton.addEventListener('click', () => {
        paymentOverlay.classList.add('hidden');
    });



    // --- INISIALISASI APLIKASI ---
    async function initializeApp() {
        await fetchPaymentSetting();
        await fetchInventory();
        await fetchProducts();
        renderCart();
    }
    initializeApp();
});