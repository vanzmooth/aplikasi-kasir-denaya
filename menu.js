// PENTING: Salin konfigurasi Firebase Anda dari app.js ke sini
const firebaseConfig = {
  apiKey: "AIzaSyD0Qh1Fimh9iYT8dOi91beIbc1wDe80R0g",
  authDomain: "aplikasikasirpwa.firebaseapp.com",
  projectId: "aplikasikasirpwa",
  storageBucket: "aplikasikasirpwa.firebasestorage.app",
  messagingSenderId: "820452190086",
  appId: "1:820452190086:web:695af51a9d5ac707e22e07"
};
// PENTING: Salin konfigurasi Firebase Anda dari app.js ke sini

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();


// Gunakan nama localStorage yang berbeda untuk keranjang pelanggan
const CART_STORAGE_KEY = 'customerCart';

let cart = JSON.parse(localStorage.getItem(CART_STORAGE_KEY)) || [];
let products = [];

const productListEl = document.getElementById('product-list');
const cartItemsEl = document.getElementById('cart-items');
const totalPriceEl = document.getElementById('total-price');
const checkoutButton = document.getElementById('checkout-button');
// Di menu.js, bagian atas
const paymentOverlay = document.getElementById('payment-overlay');
const paymentTotalAmountEl = document.getElementById('payment-total-amount');
const confirmPaymentButton = document.getElementById('confirm-payment-button');
const cancelPaymentButton = document.getElementById('cancel-payment-button');

function formatRupiah(number) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(number);
}

async function fetchProducts() {
    productListEl.innerHTML = '<p>Memuat menu...</p>';
    try {
        const snapshot = await db.collection('products').get();
        if (snapshot.empty) {
            productListEl.innerHTML = '<p>Menu belum tersedia.</p>';
            return;
        }
        products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderProducts();
    } catch (error) {
        console.error("Error mengambil produk: ", error);
        productListEl.innerHTML = '<p>Gagal memuat menu. Coba lagi nanti.</p>';
    }
}

function renderProducts() {
    productListEl.innerHTML = '';
    products.forEach(product => {
        const productCard = document.createElement('div');
        productCard.className = 'product-card';
        // Cek apakah item ini ada di keranjang
        const itemInCart = cart.find(cartItem => cartItem.id === product.id);
        const quantityInCart = itemInCart ? itemInCart.quantity : 0;

        // Tambahkan kelas 'in-cart' jika produk ada di keranjang
        if (quantityInCart > 0) {
            productCard.classList.add('in-cart');
        }
        // LOGIKA BARU: Cek stok berdasarkan stock_id produk
        let isOutOfStock = false;
        if (product.stock_id && inventory[product.stock_id] <= 0) {
            isOutOfStock = true;
        }

        if (isOutOfStock) {
            productCard.classList.add('out-of-stock');
        }
        // --- AKHIR LOGIKA BARU ---
        productCard.innerHTML = `
            ${quantityInCart > 0 ? `<div class="quantity-badge">${quantityInCart}</div>` : ''}
            <img src="${product.image || 'https://placehold.co/100x100?text=Produk'}" alt="${product.name}">
            <div class="product-name">${product.name}</div>
            <div class="product-price">${formatRupiah(product.price)}</div>
        `;
        // Gunakan klik biasa yang sederhana untuk pelanggan
        if (!isOutOfStock) {
        productCard.addEventListener('click', () => addToCart(product.id));
        }
        productListEl.appendChild(productCard);
    });
}

// Ganti seluruh fungsi addToCart Anda dengan versi ini
// Ganti fungsi addToCart di menu.js dengan ini
// Ganti fungsi addToCart di kedua file (app.js & menu.js)
function addToCart(productId, quantityToAdd = 1) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const existingItem = cart.find(item => item.id === productId);

    // Tentukan jumlah yang akan ditambahkan
    let finalQuantityToAdd = quantityToAdd;
    // Jika item belum ada di keranjang DAN memiliki aturan min_order
    if (!existingItem && product.min_order && product.min_order > 1) {
        // Jika ini adalah klik biasa (qty 1), ubah menjadi qty minimum
        if (quantityToAdd === 1) {
            finalQuantityToAdd = product.min_order;
        }
    }

    // Validasi Stok (menggunakan finalQuantityToAdd)
    if (product.stock_id) {
        const stockId = product.stock_id;
        const stockAvailable = inventory[stockId] || 0;
        let quantityOfSameStockInCart = 0;
        cart.forEach(item => {
            if (item.stock_id === stockId) {
                quantityOfSameStockInCart += item.quantity;
            }
        });
        if (quantityOfSameStockInCart + finalQuantityToAdd > stockAvailable) {
            alert(`Maaf, stok untuk kategori ini hanya tersisa ${stockAvailable}.`);
            return;
        }
    }

    // Logika penambahan ke keranjang
    if (existingItem) {
        existingItem.quantity += quantityToAdd; // Long press tetap menambahkan seperti biasa
    } else {
        cart.push({ ...product, quantity: finalQuantityToAdd });
    }
    
    renderCart();
    renderProducts(); // <-- TAMBAHKAN INI
}




// Ganti fungsi updateCartItemQuantity di kedua file
function updateCartItemQuantity(productId, action) {
    const itemIndex = cart.findIndex(item => item.id === productId);
    if (itemIndex === -1) return;

    const item = cart[itemIndex];
    const minOrder = item.min_order || 1;

    if (action === 'increase') {
        item.quantity++;
        renderCart();
    } else if (action === 'decrease') {
        // Cek apakah pengurangan akan melanggar batas minimal
        if (item.quantity - 1 < minOrder) {
            alert(`Minimal pembelian untuk ${item.name} adalah ${minOrder} pcs. Gunakan tombol hapus untuk membatalkan.`);
            // Jangan lakukan apa-apa jika akan melanggar batas
            return; 
        }

        item.quantity--;

        // Jika kuantitas jadi 0 (hanya untuk item tanpa min_order), hapus
        if (item.quantity <= 0) {
            cart.splice(itemIndex, 1);
        }
        renderCart();
        renderProducts(); // <-- TAMBAHKAN INI
    }
}

// Ganti fungsi setCartItemQuantity di kedua file
function setCartItemQuantity(productId, newQuantity) {
    const itemIndex = cart.findIndex(item => item.id === productId);
    if (itemIndex === -1) return;

    const item = cart[itemIndex];
    const minOrder = item.min_order || 1;
    const quantity = parseInt(newQuantity);

    if (isNaN(quantity)) {
        renderCart(); // Jika input bukan angka, kembalikan ke nilai semula
        return;
    }

    if (quantity < minOrder) {
        alert(`Minimal pembelian untuk ${item.name} adalah ${minOrder} pcs.`);
        // Jika input 0 atau kurang dan tidak ada min_order, hapus itemnya
        if (quantity <= 0 && minOrder <= 1) {
            cart.splice(itemIndex, 1);
        }
    } else {
        item.quantity = quantity;
    }
    
    renderCart(); // Selalu render ulang untuk menampilkan nilai yang benar
    renderProducts(); // <-- TAMBAHKAN INI
}


// Pastikan fungsi ini ada di app.js dan menu.js
async function fetchInventory() {
    try {
        const doc = await db.collection('counters').doc('stock_tracker').get();
        if (doc.exists) {
            inventory = doc.data(); // Mengisi variabel global 'inventory'
            console.log("Data stok berhasil dimuat:", inventory);
        } else {
            console.error("Dokumen pelacak stok ('stock_tracker') tidak ditemukan!");
        }
    } catch (error) {
        console.error("Gagal memuat data stok:", error);
    }
}
// Tambahkan fungsi baru ini di kedua file
function removeItemFromCart(productId) {
    const itemIndex = cart.findIndex(item => item.id === productId);
    if (itemIndex > -1) {
        cart.splice(itemIndex, 1); // Hapus item dari array keranjang
        renderCart(); // Render ulang keranjang untuk menampilkan perubahan
        renderProducts(); // <-- TAMBAHKAN INI
    }
}
function renderCart() {
    cartItemsEl.innerHTML = '';
    if (cart.length === 0) {
        cartItemsEl.innerHTML = '<p>Pilih jajanan yang kamu suka!</p>';
    } else {
        cart.forEach(item => {
            const cartItem = document.createElement('div');
            cartItem.className = 'cart-item';
            // ... di dalam renderCart() ...
cartItem.innerHTML = `
    <span class="cart-item-name">${item.name}</span>
    <div class="cart-item-controls">
        <button class="btn-quantity" data-id="${item.id}" data-action="decrease">-</button>
        <input type="number" class="cart-item-quantity" value="${item.quantity}" min="1" data-id="${item.id}">
        <button class="btn-quantity" data-id="${item.id}" data-action="increase">+</button>
    </div>
    <span class="cart-item-price">${formatRupiah(item.price * item.quantity)}</span>
    <button class="btn-remove" data-id="${item.id}">🗑️</button>
            `;
            cartItemsEl.appendChild(cartItem);
        });
    }
    const totalPrice = cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    totalPriceEl.textContent = formatRupiah(totalPrice);
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
}

// --- Event Listener ---

cancelPaymentButton.addEventListener('click', () => {
    paymentOverlay.classList.add('hidden');
});

cartItemsEl.addEventListener('click', (event) => {
    // Logika untuk tombol kuantitas
    if (event.target.classList.contains('btn-quantity')) {
        const productId = event.target.dataset.id;
        const action = event.target.dataset.action;
        updateCartItemQuantity(productId, action);
    }
    
    // Logika baru untuk tombol hapus
    if (event.target.classList.contains('btn-remove')) {
        const productId = event.target.dataset.id;
        removeItemFromCart(productId);
    }
});

cartItemsEl.addEventListener('change', (event) => {
    if (event.target.classList.contains('cart-item-quantity')) {
        const productId = event.target.dataset.id;
        const newQuantity = parseInt(event.target.value);
        setCartItemQuantity(productId, newQuantity);
    }
});

// Ganti listener checkoutButton dengan ini
checkoutButton.addEventListener('click', async () => {
    if (cart.length === 0) {
        alert('Keranjang Anda masih kosong!');
        return;
    }
    
    // // --- LOGIKA BARU UNTUK MENGAMBIL NAMA ---
    // const customerNameInput = document.getElementById('customer-name');
    // const customerName = customerNameInput.value.trim(); // .trim() untuk menghapus spasi di awal/akhir

    // if (!customerName) {
    //     alert('Harap isi nama Anda untuk panggilan pesanan.');
    //     customerNameInput.focus(); // Fokuskan kursor ke input nama
    //     return;
    // }
    // // --- AKHIR LOGIKA BARU ---
    
    checkoutButton.disabled = true;
    checkoutButton.textContent = 'Memproses...';

    const totalAmount = cart.reduce((total, item) => total + (Number(item.price) * Number(item.quantity)), 0);

    // Tampilkan total di overlay
    paymentTotalAmountEl.textContent = formatRupiah(totalAmount);
    // Tambahkan baris ini untuk menyimpan status 'sedang membayar'
    localStorage.setItem('paymentInProgress', 'true');
    // Tampilkan overlay
    paymentOverlay.classList.remove('hidden');

    // Kembalikan tombol checkout ke normal
    checkoutButton.disabled = false;
    checkoutButton.textContent = 'Pesan & Bayar Sekarang';
});

// Tambahkan listener baru ini di menu.js
// Ganti seluruh listener confirmPaymentButton dengan versi baru ini
// Ganti seluruh listener confirmPaymentButton dengan versi ini
confirmPaymentButton.addEventListener('click', async () => {
    const customerNameInput = document.getElementById('customer-name');
    const customerName = customerNameInput.value.trim();

    if (!customerName) {
        alert('Harap isi nama Anda untuk panggilan pesanan.');
        customerNameInput.focus();
        return;
    }

    confirmPaymentButton.disabled = true;
    confirmPaymentButton.textContent = 'Memvalidasi Stok...';

    try {
        // --- VALIDASI STOK MENYELURUH SEBELUM CHECKOUT ---
        const stockRef = db.collection('counters').doc('stock_tracker');
        const stockDoc = await stockRef.get();
        if (!stockDoc.exists) throw new Error("Data stok tidak ditemukan.");
        
        const currentStock = stockDoc.data();
        const stockNeeded = {}; // Menghitung kebutuhan stok dari keranjang

        cart.forEach(item => {
            if (item.stock_id) {
                stockNeeded[item.stock_id] = (stockNeeded[item.stock_id] || 0) + item.quantity;
            }
        });

        // Cek setiap item yang dibutuhkan dengan stok yang ada
        for (const stockId in stockNeeded) {
            if (!currentStock[stockId] || currentStock[stockId] < stockNeeded[stockId]) {
                // Jika stok tidak cukup, lempar error SPESIFIK
                throw new Error(`Maaf, stok untuk ${stockId.replace('stok_','')} tidak mencukupi. Sisa stok: ${currentStock[stockId] || 0}.`);
            }
        }
        // --- AKHIR VALIDASI ---

        // Jika lolos validasi, lanjutkan proses
        confirmPaymentButton.textContent = 'Mengonfirmasi...';
        const totalAmount = cart.reduce((total, item) => total + (Number(item.price) * Number(item.quantity)), 0);
        const pendingOrderData = {
            items: cart,
            totalAmount: totalAmount,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'menunggu_validasi',
            customerName: customerName
        };

        const docRef = await db.collection('pending_orders').add(pendingOrderData);
         // ...
    paymentOverlay.classList.add('hidden');
    
    // UBAH ALERT INI
    alert('Pesanan Anda telah dikirim ke kasir untuk divalidasi. Terima kasih!');
    
        cart = [];
        localStorage.removeItem(CART_STORAGE_KEY);
        window.location.href = `status.html?id=${docRef.id}`;

    } catch (error) {
        console.error("Gagal checkout:", error);
        alert(`Gagal melanjutkan pesanan: ${error.message}`); // Tampilkan pesan error yang spesifik
    } finally {
        // Selalu kembalikan tombol ke keadaan normal
        confirmPaymentButton.disabled = false;
        confirmPaymentButton.textContent = 'Saya Sudah Bayar';
    }
});




// Di menu.js, bagian paling bawah

// --- INISIALISASI ---
// Fungsi ini akan memeriksa apakah ada pembayaran yang tertunda saat halaman dimuat
function checkOngoingPayment() {
    if (localStorage.getItem('paymentInProgress') === 'true' && cart.length > 0) {
        console.log("Pembayaran sedang berlangsung terdeteksi. Menampilkan kembali overlay.");
        const totalAmount = cart.reduce((total, item) => total + (Number(item.price) * Number(item.quantity)), 0);
        paymentTotalAmountEl.textContent = formatRupiah(totalAmount);
        paymentOverlay.classList.remove('hidden');
    }
}

// GUNAKAN BLOK BARU INI
// --- INISIALISASI APLIKASI ---

async function initializeApp() {
    // Langkah 1: Ambil data stok terlebih dahulu dan tunggu sampai selesai.
    await fetchInventory(); 
    
    // Langkah 2: Setelah stok ada, baru ambil data produk.
    await fetchProducts(); // fetchProducts akan memanggil renderProducts secara internal
    
    // Langkah 3: Render keranjang dari localStorage.
    renderCart();
    
    // Langkah 4 (Hanya untuk app.js): Aktifkan semua listener.
    if (typeof fetchTransactions === 'function') {
        fetchTransactions();
    }
    if (typeof listenForPendingOrders === 'function') {
        listenForPendingOrders();
    }
}

// Jalankan fungsi inisialisasi utama
initializeApp();

checkOngoingPayment(); // Panggil fungsi pengecekan di sini
