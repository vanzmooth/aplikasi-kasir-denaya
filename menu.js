// =======================================================
// HALAMAN MENU PELANGGAN - VERSI FINAL BERSIH
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

// --- VARIABEL GLOBAL ---
const CART_STORAGE_KEY = 'customerCart';
let cart = JSON.parse(localStorage.getItem(CART_STORAGE_KEY)) || [];
let products = [];
let inventory = {};
let finalUniqueTotal = 0;

// --- ELEMEN DOM ---
const productListEl = document.getElementById('product-list');
const cartItemsEl = document.getElementById('cart-items');
const totalPriceEl = document.getElementById('total-price');
const checkoutButton = document.getElementById('checkout-button');
const paymentOverlay = document.getElementById('payment-overlay');
const confirmPaymentButton = document.getElementById('confirm-payment-button');
const cancelPaymentButton = document.getElementById('cancel-payment-button');

// --- FUNGSI-FUNGSI ---
function formatRupiah(number) { return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number); }
async function fetchInventory() { try { const doc = await db.collection('counters').doc('stock_tracker').get(); if (doc.exists) { inventory = doc.data(); console.log("Stok dimuat:", inventory); } else { console.error("Dokumen stok tidak ditemukan!"); } } catch (error) { console.error("Gagal memuat stok:", error); } }
async function fetchProducts() { productListEl.innerHTML = '<p>Memuat menu...</p>'; try { const snapshot = await db.collection('products').get(); if (snapshot.empty) { productListEl.innerHTML = '<p>Menu belum tersedia.</p>'; return; } products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); renderProducts(); } catch (error) { productListEl.innerHTML = '<p>Gagal memuat menu.</p>'; } }
function renderProducts() { productListEl.innerHTML = ''; products.forEach(product => { const productCard = document.createElement('div'); productCard.className = 'product-card'; const itemInCart = cart.find(cartItem => cartItem.id === product.id); const quantityInCart = itemInCart ? itemInCart.quantity : 0; if (quantityInCart > 0) productCard.classList.add('in-cart'); let isOutOfStock = (product.stock_id && (inventory[product.stock_id] === undefined || inventory[product.stock_id] <= 0)); if (isOutOfStock) productCard.classList.add('out-of-stock'); productCard.innerHTML = `${quantityInCart > 0 ? `<div class="quantity-badge">${quantityInCart}</div>` : ''}<img src="${product.image || 'https://placehold.co/100x100?text=Produk'}" alt="${product.name}"><div class="product-name">${product.name}</div><div class="product-price">${formatRupiah(product.price)}</div>`; if (!isOutOfStock) { productCard.addEventListener('click', () => addToCart(product.id)); } productListEl.appendChild(productCard); }); }
function renderCart() { cartItemsEl.innerHTML = ''; if (cart.length === 0) { cartItemsEl.innerHTML = '<p>Pilih jajanan yang kamu suka!</p>'; } else { cart.forEach(item => { const cartItem = document.createElement('div'); cartItem.className = 'cart-item'; cartItem.innerHTML = `<span class="cart-item-name">${item.name}</span><div class="cart-item-controls"><button class="btn-quantity" data-id="${item.id}" data-action="decrease">-</button><input type="number" class="cart-item-quantity" value="${item.quantity}" min="1" data-id="${item.id}"><button class="btn-quantity" data-id="${item.id}" data-action="increase">+</button></div><span class="cart-item-price">${formatRupiah(item.price*item.quantity)}</span><button class="btn-remove" data-id="${item.id}">🗑️</button>`; cartItemsEl.appendChild(cartItem); }); } const totalPrice = cart.reduce((total, item) => total + (item.price*item.quantity), 0); totalPriceEl.textContent = formatRupiah(totalPrice); localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart)); }
function addToCart(productId, quantityToAdd = 1) { const product = products.find(p => p.id === productId); if (!product || !product.stock_id) { alert("Produk ini tidak memiliki ID Stok."); return; } const stockId = product.stock_id; const stockAvailable = inventory[stockId] || 0; let quantityOfSameStockInCart = 0; cart.forEach(item => { if (item.stock_id === stockId) quantityOfSameStockInCart += item.quantity; }); const existingItem = cart.find(item => item.id === productId); let finalQuantityToAdd = quantityToAdd; if (!existingItem && product.min_order > 1) { if (quantityToAdd === 1) finalQuantityToAdd = product.min_order; } if (quantityOfSameStockInCart + finalQuantityToAdd > stockAvailable) { alert(`Stok untuk kategori ini hanya tersisa ${stockAvailable}.`); return; } if (existingItem) existingItem.quantity += quantityToAdd; else cart.push({ ...product, quantity: finalQuantityToAdd }); renderCart(); renderProducts(); }
function updateCartItemQuantity(productId, action) { const itemIndex = cart.findIndex(item => item.id === productId); if (itemIndex === -1) return; const item = cart[itemIndex]; const minOrder = item.min_order || 1; if (action === 'increase') { item.quantity++; } else if (action === 'decrease') { if (item.quantity - 1 < minOrder) { alert(`Minimal pembelian untuk ${item.name} adalah ${minOrder} pcs. Gunakan tombol hapus.`); return; } item.quantity--; if (item.quantity <= 0) cart.splice(itemIndex, 1); } renderCart(); renderProducts(); }
function setCartItemQuantity(productId, newQuantity) { const itemIndex = cart.findIndex(item => item.id === productId); if (itemIndex === -1) return; const item = cart[itemIndex]; const minOrder = item.min_order || 1; const quantity = parseInt(newQuantity); if (isNaN(quantity)) { renderCart(); return; } if (quantity < minOrder) { alert(`Minimal pembelian untuk ${item.name} adalah ${minOrder} pcs.`); if (quantity <= 0 && minOrder <= 1) cart.splice(itemIndex, 1); } else { item.quantity = quantity; } renderCart(); renderProducts(); }
function removeItemFromCart(productId) { const itemIndex = cart.findIndex(item => item.id === productId); if (itemIndex > -1) { cart.splice(itemIndex, 1); renderCart(); renderProducts(); } }

// --- EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    // Pastikan semua elemen ada sebelum memasang listener
    const checkoutButton = document.getElementById('checkout-button');
    const confirmPaymentButton = document.getElementById('confirm-payment-button');
    const cancelPaymentButton = document.getElementById('cancel-payment-button');
    const cartItemsEl = document.getElementById('cart-items');

    if(cartItemsEl) {
        cartItemsEl.addEventListener('click', (event) => {
            if (event.target.classList.contains('btn-quantity')) updateCartItemQuantity(event.target.dataset.id, event.target.dataset.action);
            if (event.target.classList.contains('btn-remove')) removeItemFromCart(event.target.dataset.id);
        });
        cartItemsEl.addEventListener('change', (event) => { if (event.target.classList.contains('cart-item-quantity')) setCartItemQuantity(event.target.dataset.id, event.target.value); });
    }

    if(checkoutButton) {
        checkoutButton.addEventListener('click', () => {
            if (cart.length === 0) { alert('Keranjang Anda masih kosong!'); return; }
            const totalAmount = cart.reduce((total, item) => total + (Number(item.price) * Number(item.quantity)), 0);
            const uniqueCode = Math.floor(Math.random() * 900) + 100;
            finalUniqueTotal = totalAmount + uniqueCode;
            document.getElementById('original-total-amount').textContent = formatRupiah(totalAmount);
            document.getElementById('unique-code').textContent = `+ ${formatRupiah(uniqueCode)}`;
            document.getElementById('final-unique-total').textContent = formatRupiah(finalUniqueTotal);
            paymentOverlay.classList.remove('hidden');
        });
    }

    if(confirmPaymentButton) {
        confirmPaymentButton.addEventListener('click', async () => {
            const customerNameInput = document.getElementById('customer-name');
            const customerName = customerNameInput.value.trim();
            if (!customerName) { alert('Harap isi nama Anda.'); customerNameInput.focus(); return; }
            confirmPaymentButton.disabled = true;
            confirmPaymentButton.textContent = 'Memproses...';
            
            const pendingOrderData = { items: cart, totalAmount: finalUniqueTotal, createdAt: firebase.firestore.FieldValue.serverTimestamp(), status: 'menunggu_validasi', customerName: customerName };
            try {
                // Validasi stok sekali lagi sebelum mengirim
                const stockRef = db.collection('counters').doc('stock_tracker');
                const stockDoc = await stockRef.get();
                if (!stockDoc.exists) throw new Error("Data stok tidak ditemukan.");
                const currentStock = stockDoc.data();
                const stockNeeded = {};
                cart.forEach(item => { if (item.stock_id) stockNeeded[item.stock_id] = (stockNeeded[item.stock_id] || 0) + item.quantity; });
                for (const stockId in stockNeeded) {
                    if (!currentStock[stockId] || currentStock[stockId] < stockNeeded[stockId]) {
                        throw new Error(`Maaf, stok untuk ${stockId.replace('stok_','')} tidak mencukupi.`);
                    }
                }

                const docRef = await db.collection('pending_orders').add(pendingOrderData);
                cart = [];
                localStorage.removeItem(CART_STORAGE_KEY);
                renderCart();
                renderProducts();
                window.location.href = `status.html?id=${docRef.id}`;
            } catch (error) {
                alert(`Gagal mengirim pesanan: ${error.message}`);
                confirmPaymentButton.disabled = false;
                confirmPaymentButton.textContent = 'Saya Sudah Bayar';
            }
        });
    }

    if(cancelPaymentButton) {
        cancelPaymentButton.addEventListener('click', () => {
            paymentOverlay.classList.add('hidden');
        });
    }

    // --- INISIALISASI APLIKASI ---
    async function initializeApp() {
        await fetchInventory();
        await fetchProducts();
        renderCart();
    }
    initializeApp();
});