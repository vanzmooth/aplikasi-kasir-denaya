// =======================================================
// APLIKASI KASIR - VERSI FINAL BERSIH
// =======================================================

// --- KONFIGURASI & INISIALISASI FIREBASE ---
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

// --- VARIABEL GLOBAL ---
let cart = JSON.parse(localStorage.getItem('keranjangBelanja')) || [];
let products = [];
let inventory = {};

// --- ELEMEN DOM ---
// --- ELEMEN DOM ---
const productListEl = document.getElementById('product-list');
const cartItemsEl = document.getElementById('cart-items');
const totalPriceEl = document.getElementById('total-price');
const validationListEl = document.getElementById('validation-list');
const transactionListEl = document.getElementById('transaction-list');
const logoutButton = document.getElementById('logout-button');
const modeManualRadio = document.getElementById('mode-manual');
const modeOtomatisRadio = document.getElementById('mode-otomatis');
const validationSection = document.querySelector('.validation-section');
const selfOrderingSwitchDiv = document.getElementById('self-ordering-switch');
const cashPaymentOverlay = document.getElementById('cash-payment-overlay');
const cashTotalAmountEl = document.getElementById('cash-total-amount');
const cashChangeAmountEl = document.getElementById('cash-change-amount');
// --- FUNGSI-FUNGSI UTAMA ---
// =======================================================

function formatRupiah(number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number);
}
// Tambahkan fungsi baru ini di app.js
// Ganti fungsi setupPaymentSwitch dengan setupSettings ini di app.js
function setupSettings() {
    const settingRef = db.collection('settings').doc('payment');

    // Listener untuk semua perubahan pengaturan
    settingRef.onSnapshot(doc => {
        if (doc.exists) {
            const settings = doc.data();

            // Logika untuk saklar mode pembayaran
            const activeMethod = settings.active_method || 'manual';
            if (activeMethod === 'otomatis') modeOtomatisRadio.checked = true;
            else modeManualRadio.checked = true;

            // LOGIKA BARU UNTUK SAKLAR PEMESANAN MANDIRI
            const selfOrderingEnabled = settings.self_ordering_enabled !== false; // default ke true jika tidak ada
            if (selfOrderingEnabled) document.getElementById('mode-on').checked = true;
            else document.getElementById('mode-off').checked = true;

            // Tampilkan/sembunyikan panel validasi berdasarkan mode pembayaran
            if (activeMethod === 'manual') validationSection.classList.remove('hidden');
            else validationSection.classList.add('hidden');
        }
    });

    // Event listener untuk setiap saklar
    document.getElementById('payment-mode-switch').addEventListener('change', (e) => {
        settingRef.update({ active_method: e.target.value });
    });
    document.getElementById('self-ordering-switch').addEventListener('change', (e) => {
        // Ubah string "true"/"false" dari radio button menjadi boolean
        settingRef.update({ self_ordering_enabled: e.target.value === 'true' });
    });
}
// Tambahkan kembali fungsi ini di app.js
function createReceiptLine(leftText, rightText, maxChars = 30) {
    const leftLength = leftText.length;
    const rightLength = rightText.length;
    const spacesNeeded = maxChars - leftLength - rightLength;

    if (spacesNeeded < 1) {
        // Jika teks terlalu panjang, buat harga di baris baru agar tidak terpotong
        return `${leftText}\n${' '.repeat(maxChars - rightLength)}${rightText}`;
    }

    const spaces = ' '.repeat(spacesNeeded);
    return `${leftText}${spaces}${rightText}`;
}

async function fetchInventory() {
    try {
        const doc = await db.collection('counters').doc('stock_tracker').get();
        if (doc.exists) {
            inventory = doc.data();
            console.log("Data stok berhasil dimuat:", inventory);
        } else {
            console.error("Dokumen pelacak stok ('stock_tracker') tidak ditemukan!");
        }
    } catch (error) {
        console.error("Gagal memuat data stok:", error);
    }
}

async function fetchProducts() {
    productListEl.innerHTML = '<p>Memuat produk...</p>';
    try {
        const snapshot = await db.collection('products').get();
        products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderProducts();
    } catch (error) {
        console.error("Error mengambil produk: ", error);
        productListEl.innerHTML = '<p>Gagal memuat produk. Coba lagi.</p>';
    }
}

// Ganti seluruh fungsi renderProducts di app.js dengan ini
function renderProducts() {
    productListEl.innerHTML = '';
    products.forEach(product => {
        const productCard = document.createElement('div');
        productCard.className = 'product-card';
        productCard.setAttribute('data-product-id', product.id); // Tambahkan ID untuk referensi

        // Cek apakah item ini ada di keranjang
        const itemInCart = cart.find(cartItem => cartItem.id === product.id);
        const quantityInCart = itemInCart ? itemInCart.quantity : 0;

        // Tambahkan kelas 'in-cart' jika produk ada di keranjang
        if (quantityInCart > 0) {
            productCard.classList.add('in-cart');
        }

        // Cek stok
        let isOutOfStock = false;
        if (product.stock_id && (inventory[product.stock_id] === undefined || inventory[product.stock_id] <= 0)) {
            isOutOfStock = true;
        }
        if (isOutOfStock) {
            productCard.classList.add('out-of-stock');
        }

        // Buat HTML, termasuk badge kuantitas
        productCard.innerHTML = `
            ${quantityInCart > 0 ? `<div class="quantity-badge">${quantityInCart}</div>` : ''}
            <img src="${product.image || 'https://placehold.co/100x100?text=Produk'}" alt="${product.name}">
            <div class="product-name">${product.name}</div>
            <div class="product-price">${formatRupiah(product.price)}</div>
        `;

        // Pasang event listener hanya jika stok ada
        if (!isOutOfStock) {
            let pressTimer, longPressTriggered = false, isScrolling = false;
            const longPressAmount = 5;
            const longPressDuration = 600;

            const startPress = (e) => {
                isScrolling = false; longPressTriggered = false;
                pressTimer = setTimeout(() => {
                    if (!isScrolling) { longPressTriggered = true; addToCart(product.id, longPressAmount); }
                }, longPressDuration);
            };
            const cancelPress = () => { isScrolling = true; clearTimeout(pressTimer); };
            const endPress = (e) => {
                e.preventDefault(); clearTimeout(pressTimer);
                if (!longPressTriggered && !isScrolling) { addToCart(product.id, 1); }
            };

            productCard.addEventListener('mousedown', startPress);
            productCard.addEventListener('mouseup', endPress);
            productCard.addEventListener('mouseleave', cancelPress);
            productCard.addEventListener('touchstart', startPress);
            productCard.addEventListener('touchend', endPress);
            productCard.addEventListener('touchmove', cancelPress);
        }

        productListEl.appendChild(productCard);
    });
}

function renderCart() {
    cartItemsEl.innerHTML = '';
    if (cart.length === 0) {
        cartItemsEl.innerHTML = '<p>Keranjang masih kosong.</p>';
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
    <button class="btn-remove" data-id="${item.id}">🗑️</button> `;
            cartItemsEl.appendChild(cartItem);
        });
    }
    const totalPrice = cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    totalPriceEl.textContent = formatRupiah(totalPrice);
    localStorage.setItem('keranjangBelanja', JSON.stringify(cart));
}

// Ganti fungsi addToCart di kedua file (app.js & menu.js)
// Ganti seluruh fungsi addToCart di app.js dengan versi ini
function addToCart(productId, quantityToAdd = 1) {
    const product = products.find(p => p.id === productId);
    if (!product || !product.stock_id) {
        alert("Produk ini tidak memiliki ID Stok, tidak bisa diproses.");
        return;
    }

    const existingItem = cart.find(item => item.id === productId);

    // --- LOGIKA BARU UNTUK MINIMAL ORDER & LONG PRESS ---
    let finalQuantityToAdd;
    if (existingItem) {
        // Jika item sudah ada, cukup tambahkan kuantitas seperti biasa
        finalQuantityToAdd = quantityToAdd;
    } else {
        // Jika ini item baru, tentukan kuantitas awalnya
        const minOrder = product.min_order || 1;
        // Ambil nilai yang lebih besar antara minimal order dan kuantitas dari input (1 atau 5)
        finalQuantityToAdd = Math.max(minOrder, quantityToAdd);
    }
    // --- AKHIR LOGIKA BARU ---

    // Validasi Stok (menggunakan finalQuantityToAdd)
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

    // Logika penambahan ke keranjang
    if (existingItem) {
        existingItem.quantity += finalQuantityToAdd;
    } else {
        cart.push({ ...product, quantity: finalQuantityToAdd });
    }

    renderCart();
    renderProducts();
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
        renderProducts();
    }
}

// Tambahkan fungsi baru ini di kedua file
function removeItemFromCart(productId) {
    const itemIndex = cart.findIndex(item => item.id === productId);
    if (itemIndex > -1) {
        cart.splice(itemIndex, 1); // Hapus item dari array keranjang
        renderCart(); // Render ulang keranjang untuk menampilkan perubahan
        renderProducts();
    }
}

function updateProductCardUI(productId) {
    const productCard = document.querySelector(`.product-card[data-product-id="${productId}"]`);
    if (!productCard) return;
    const itemInCart = cart.find(item => item.id === productId);
    const quantityInCart = itemInCart ? itemInCart.quantity : 0;
    let badge = productCard.querySelector('.quantity-badge');
    if (quantityInCart > 0) {
        if (!badge) { badge = document.createElement('div'); badge.className = 'quantity-badge'; productCard.prepend(badge); }
        badge.textContent = quantityInCart;
        productCard.classList.add('in-cart');
    } else {
        if (badge) badge.remove();
        productCard.classList.remove('in-cart');
    }
}

// --- FUNGSI BARU YANG HILANG SEBELUMNYA ---
function updateAllProductBadges() {
    products.forEach(p => updateProductCardUI(p.id));
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
    renderProducts();
}


async function updateStock(items) {
    const stockRef = db.collection('counters').doc('stock_tracker');
    const stockToReduce = {};
    items.forEach(item => { if (item.stock_id) stockToReduce[item.stock_id] = (stockToReduce[item.stock_id] || 0) + item.quantity; });
    if (Object.keys(stockToReduce).length === 0) return;
    return db.runTransaction(async (transaction) => {
        const stockDoc = await transaction.get(stockRef);
        if (!stockDoc.exists) throw new Error("Dokumen stok tidak ditemukan!");
        const currentStock = stockDoc.data();
        const updates = {};
        const historyBatch = db.batch();
        for (const stockId in stockToReduce) {
            const reductionAmount = stockToReduce[stockId];
            if (!currentStock[stockId] || currentStock[stockId] < reductionAmount) throw new Error(`Stok untuk ${stockId} tidak mencukupi!`);
            updates[stockId] = firebase.firestore.FieldValue.increment(-reductionAmount);
            const historyRef = db.collection('stock_history').doc();
            historyBatch.set(historyRef, {
                stock_id: stockId,
                change: -reductionAmount,
                reason: "Penjualan",
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        transaction.update(stockRef, updates);
        return historyBatch.commit();
    });
}

async function getNextQueueNumber() {
    let newQueueNumber = 1;
    const counterRef = db.collection('counters').doc('dailyQueue');
    const todayStr = new Date().toISOString().slice(0, 10);
    try {
        const counterDoc = await counterRef.get();
        if (counterDoc.exists) {
            const data = counterDoc.data();
            if (data.lastResetDate === todayStr) newQueueNumber = data.lastNumber + 1;
        }
        await counterRef.set({ lastNumber: newQueueNumber, lastResetDate: todayStr }, { merge: true });
        return newQueueNumber;
    } catch (error) { return Math.floor(Math.random() * 100); }
}

// Pastikan fungsi finalizeTransaction Anda seperti ini
// GANTI FUNGSI INI DI app.js
async function finalizeTransaction(items, paymentInfo = {}, customerName = 'Walk-in Customer', originalOrderId = null) {
    await updateStock(items);
    const queueNumber = await getNextQueueNumber();
    const totalAmount = items.reduce((total, item) => total + (Number(item.price) * Number(item.quantity)), 0);

    // Siapkan data lengkap yang akan disimpan
    const finalTransactionData = {
        items: items,
        totalAmount: totalAmount,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        status: "Sedang Disiapkan",
        queueNumber: queueNumber,
        customerName: customerName,
        originalOrderId: originalOrderId,
        payment: paymentInfo // <-- KUNCI: Info pembayaran sekarang ikut disimpan
    };

    const docRef = await db.collection('transactions').add(finalTransactionData);

    if (originalOrderId) {
        await db.collection('pending_orders').doc(originalOrderId).delete();
    }

    // Kembalikan objek lengkap untuk dicetak
    return { id: docRef.id, ...finalTransactionData, createdAt: new Date() };
}

// GANTI SELURUH FUNGSI PRINTRECEIPT LAMA ANDA DENGAN VERSI LENGKAP INI
function printReceipt(transaction) {
    const storeInfo = {
        name: "Dimsum Denaya",
        address: "Jl. Pucung No.13, Pucung, Kec. Kota Baru, Karawang, Jawa Barat 41374<br>(Teras Abu Bakar Mart)",
        phone: "WA: 0878-2603-6767",
    };

    // --- LOGIKA TANGGAL YANG SUDAH PINTAR ---
    const txDateObject = transaction.createdAt.toDate ? transaction.createdAt.toDate() : transaction.createdAt;
    const txDate = txDateObject.toLocaleString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    let itemsText = '';
    transaction.items.forEach(item => {
        const itemName = `${item.name} (x${item.quantity})`;
        const itemTotal = formatRupiah(item.price * item.quantity);
        itemsText += `<pre class="item-line-text">${createReceiptLine(itemName, itemTotal)}</pre>`;
    });

    // Kita gunakan fungsi createReceiptLine yang sudah ada untuk Total
    const totalLine = createReceiptLine('TOTAL', formatRupiah(transaction.totalAmount));
    let paymentHtml = `<pre class="total-line">${totalLine}</pre>`;

    // --- LOGIKA CERDAS: BACA DARI transaction.payment ---
    // Cek apakah ada data pembayaran dan metodenya adalah 'cash'
    if (transaction.payment && transaction.payment.method === 'cash') {
        const cashLine = createReceiptLine('TUNAI', formatRupiah(transaction.payment.cashAmount));
        const changeLine = createReceiptLine('KEMBALI', formatRupiah(transaction.payment.changeAmount));
        paymentHtml += `<pre>${cashLine}</pre><pre>${changeLine}</pre>`;
    }

    const qrId = transaction.originalOrderId || transaction.id;

    const baseUrl = window.location.origin;
    const statusUrl = `${baseUrl}/status.html?id=${transaction.originalOrderId || transaction.id}`;
    let qrCodeHtml = '<p>Gagal memuat QR Code.</p>';

    const qrOptions = { width: 300, margin: 1, errorCorrectionLevel: 'H' };

    QRCode.toDataURL(statusUrl, qrOptions)
        .then(url => {
            qrCodeHtml = `<img src="${url}" alt="QR Code Status Pesanan" style="width: 100%; max-width: 200px;">`;
        })
        .catch(err => {
            console.error('Gagal membuat QR Code', err);
        })
        .finally(() => {
            const receiptHtml = `
                <html>
                <head>
                    <title>Struk Transaksi</title>
                    <style>
                        /* ... (seluruh bagian CSS tidak perlu diubah dari versi terakhir) ... */
                        body { font-family: 'Courier New', monospace; font-size: 12px; color: #000; width: 100%; max-width: 280px; margin: 0; padding: 5px; }
                        p { margin: 2px 0; }
                        .text-center { text-align: center; }
                        h1 { font-size: 16px; margin: 0; }
                        .header p { font-size: 10px; word-break: break-word; }
                        .queue-number { font-size: 28px; font-weight: bold; margin: 10px 0; padding: 5px; border: 2px dashed #000; }
                        .separator { border-top: 1px dashed #000; margin: 10px 0; }
                        .item-line { margin-bottom: 5px; }
                        pre {
        white-space: pre-wrap;
        margin: 0;
        font-family: 'Courier New', monospace; 
        font-size: 12px;
        padding-top: 2px; /* Jarak antar baris tunai/kembali */
    }
.total-line { 
        font-weight: bold; 
        border-top: 1px solid #000; 
        padding-top: 5px; 
        margin-top: 5px; 
    }
                        .footer { margin-top: 15px; }
                    </style>
                </head>
                <body>
                    <div class="text-center"><h1>${storeInfo.name}</h1><p>${storeInfo.address}</p><p>${storeInfo.phone}</p></div>
                    <div class="separator"></div>
                    <p>No: ${transaction.id.substring(0, 8)}</p>
                    <p>Tgl: ${txDate}</p>
                    <p>Antrian: #${transaction.queueNumber}</p>
                    <div class="separator"></div>
                    <div>${itemsText}</div>
                    <pre>${paymentHtml}</pre>
                    <div class="footer text-center">
                        <p>Terima kasih sudah jajan di Jajanan Denaya!</p>
                        <p>Pantau status pesanan Anda.</p>
                        <div style="margin-top:10px;">${qrCodeHtml}</div>
                    </div>
                </body>
                </html>
            `;

            const printWindow = window.open('', '_blank');
            printWindow.document.write(receiptHtml);
            printWindow.document.close();
            printWindow.focus();

            printWindow.onload = function () {
                printWindow.print();
            };
        });
}


function fetchTransactions() {
    db.collection('transactions').orderBy('createdAt', 'desc').limit(20).onSnapshot(snapshot => {
        if (snapshot.empty) { transactionListEl.innerHTML = '<p>Belum ada riwayat transaksi.</p>'; return; }
        transactionListEl.innerHTML = '';
        snapshot.docs.forEach(doc => {
            const tx = { id: doc.id, ...doc.data() };
            const txDate = tx.createdAt.toDate().toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });
            let itemsDetailHtml = '<ul class="tx-items-list">';
            tx.items.forEach(item => { itemsDetailHtml += `<li>${item.name} (x${item.quantity})</li>`; });
            itemsDetailHtml += '</ul>';
            // --- LOGIKA BARU UNTUK TOMBOL PINTAR ---
            const isFinished = tx.status === 'Selesai';
            const isReady = tx.status === 'Siap Diambil';
            let buttonText = 'Tandai Siap';
            if (isReady) {
                buttonText = 'Selesaikan';
            }
            const txItem = document.createElement('div');
            txItem.className = 'transaction-item';
            txItem.innerHTML = `
    <div class="tx-main-info">
        <div class="tx-summary">
            <div class="tx-info">
                <span class="tx-queue">#${tx.queueNumber || '-'}</span>
                <div class="tx-details">
                    <span class="tx-customer-name">${tx.customerName || ''}</span>
                    <span class="tx-total">${formatRupiah(tx.totalAmount)}</span>
                </div>
            </div>
            <div class="tx-status">
                <span class="status-badge ${isFinished ? 'status-complete' : (isReady ? 'status-ready' : 'status-preparing')}">${tx.status || 'N/A'}</span>
            </div>
        </div>
        <div class="tx-date">${txDate}</div>
    </div>

    <div class="tx-actions">
        <button class="btn-action btn-reprint" data-id="${tx.id}">Cetak</button>
        <button class="btn-action btn-change-status" 
                data-id="${tx.id}" 
                data-status="${tx.status}" 
                ${isFinished ? 'disabled' : ''}>
            ${buttonText}
        </button>
    </div>

    <div class="tx-item-details hidden">
        <p><strong>Rincian Pesanan:</strong></p>
        ${itemsDetailHtml}
    </div>`;
            transactionListEl.appendChild(txItem);
        });
    }, err => { console.error("Error mendengarkan transaksi: ", err); });
}

// Ganti seluruh fungsi listenForPendingOrders di app.js dengan ini
// GANTI SELURUH FUNGSI listenForPendingOrders ANDA DENGAN VERSI FINAL INI
function listenForPendingOrders() {
    console.log("Mendengarkan semua pesanan yang tertunda...");

    db.collection('pending_orders').onSnapshot(snapshot => {

        // Bersihkan panel validasi setiap kali ada perubahan data
        validationListEl.innerHTML = '';
        let manualOrdersFound = false;

        snapshot.docs.forEach(doc => {
            const orderData = doc.data();
            const orderId = doc.id;

            // --- INILAH LOGIKA SAKLAR UTAMANYA ---

            if (orderData.status === 'siap_diproses') {
                // JIKA OTOMATIS: Langsung proses di sini, JANGAN ditampilkan di panel
                console.log(`Memproses pesanan otomatis dari ${orderData.customerName}...`);
                finalizeTransaction(orderData.items, orderData.customerName, orderId)
                    .then(() => {
                        alert(`Pesanan Otomatis Masuk untuk ${orderData.customerName}!`);
                    })
                    .catch(error => {
                        console.error("Gagal memproses pesanan otomatis:", error);
                        alert(`GAGAL memproses pesanan dari ${orderData.customerName}: ${error.message}`);
                        // Hapus pesanan yang gagal agar tidak terjebak
                        db.collection('pending_orders').doc(orderId).delete();
                    });
            }
            else if (orderData.status === 'menunggu_validasi') {
                // JIKA MANUAL: Baru tampilkan di panel validasi
                manualOrdersFound = true;
                const validationItem = document.createElement('div');
                validationItem.className = 'validation-item';
                let itemsSummary = orderData.items.map(item => `${item.name} (x${item.quantity})`).join(', ');
                validationItem.innerHTML = `
                    <p class="validation-name">${orderData.customerName}</p>
                    <p class="validation-details">${itemsSummary}</p>
                    <p class="validation-details"><strong>Total: ${formatRupiah(orderData.totalAmount)}</strong></p>
                    <div class="validation-actions">
                        <button class="btn-approve" data-id="${orderId}">✔️ Setujui</button>
                        <button class="btn-reject" data-id="${orderId}">❌ Tolak</button>
                    </div>
                `;
                validationListEl.appendChild(validationItem);
            }
        });

        // Tampilkan pesan jika tidak ada pesanan manual sama sekali
        if (!manualOrdersFound) {
            validationListEl.innerHTML = '<p class="info-text">Belum ada pembayaran yang perlu divalidasi.</p>';
        }

    }, err => {
        console.error("Error pada listener pending_orders:", err);
    });
}

// =======================================================
// --- EVENT LISTENERS & INISIALISASI ---
// =======================================================

auth.onAuthStateChanged(user => {
    if (user) {
        console.log("Pengguna sudah login, memulai aplikasi...");
        // TAMPILKAN HALAMAN DENGAN EFEK FADE-IN
        document.body.classList.add('visible');
        initializeApp();
    } else {
        console.log("Tidak ada pengguna yang login, mengarahkan ke halaman login...");
        window.location.href = 'login.html';
    }

    // Tambahkan di app.js, laporan.js, dan stok.js
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            auth.signOut().then(() => {
                console.log('Pengguna berhasil logout.');
                // Halaman akan otomatis redirect karena ada "penjaga" onAuthStateChanged
            }).catch((error) => {
                console.error('Error saat logout:', error);
            });
        });
    }
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
validationListEl.addEventListener('click', async (event) => {
    const target = event.target;
    const orderId = target.dataset.id;
    if (!orderId) return;

    // Di dalam validationListEl.addEventListener di app.js

    if (target.classList.contains('btn-approve')) {
        target.disabled = true;
        target.textContent = 'Memproses...';
        try {
            const pendingOrderRef = db.collection('pending_orders').doc(orderId);
            const pendingOrderDoc = await pendingOrderRef.get();
            if (!pendingOrderDoc.exists) throw new Error("Pesanan tidak ditemukan lagi.");

            const orderData = pendingOrderDoc.data();

            // --- FIX #1: Urutan parameter diperbaiki & paymentInfo dibuat ---
            // Kita buat objek paymentInfo untuk konsistensi data
            const paymentInfo = {
                method: 'otomatis_disetujui',
                details: orderData.payment_details || null
            };
            // Panggil finalizeTransaction dengan urutan yang benar: (items, paymentInfo, customerName, orderId)
            await finalizeTransaction(orderData.items, paymentInfo, orderData.customerName, orderId);

            alert(`Pesanan untuk ${orderData.customerName} berhasil disetujui.`);

            // --- FIX #2: Hapus elemen dari layar secara manual ---
            // Ini memberikan feedback instan tanpa perlu menunggu onSnapshot
            target.closest('.validation-item').remove();

        } catch (error) {
            alert(`Gagal menyetujui pesanan: ${error.message}`);
            // Jika gagal, kembalikan tombol ke normal
            target.disabled = false;
            target.textContent = '✔️ Setujui';
        }
    }
    if (target.classList.contains('btn-reject')) {
        if (confirm(`Anda yakin ingin menolak pesanan ini?`)) {
            try {
                await db.collection('pending_orders').doc(orderId).delete();
                alert('Pesanan berhasil ditolak.');
            } catch (error) {
                alert('Gagal menolak pesanan.');
            }
        }
    }
});

// Ganti seluruh listener transactionListEl Anda dengan ini
// Ganti seluruh listener transactionListEl Anda dengan ini
transactionListEl.addEventListener('click', async (event) => {
    const target = event.target;

    // --- BAGIAN 1: PROSES TOMBOL AKSI ---
    if (target.classList.contains('btn-action')) {
        const transactionId = target.dataset.id;
        if (!transactionId) return;

        // Logika untuk tombol Ubah Status (Tandai Siap / Selesaikan)
        if (target.classList.contains('btn-change-status')) {
            const currentStatus = target.dataset.status;
            let newStatus = '';

            if (currentStatus === "Sedang Disiapkan") {
                newStatus = "Siap Diambil";
            } else if (currentStatus === "Siap Diambil") {
                newStatus = "Selesai";
            }

            if (newStatus) {
                try {
                    await db.collection('transactions').doc(transactionId).update({ status: newStatus });
                } catch (error) {
                    console.error("Gagal update status:", error);
                    alert("Gagal update status.");
                }
            }
        }

        // Logika untuk tombol Cetak Ulang
        if (target.classList.contains('btn-reprint')) {
            try {
                const doc = await db.collection('transactions').doc(transactionId).get();
                if (doc.exists) {
                    const transactionData = { id: doc.id, ...doc.data() };
                    printReceipt(transactionData);
                }
            } catch (error) {
                alert(`Gagal mencetak ulang struk: ${error.message}`);
            }
        }
        return; // Hentikan setelah tombol diproses
    }

    // --- BAGIAN 2: PROSES BUKA-TUTUP DETAIL ---
    const transactionItem = target.closest('.transaction-item');
    if (transactionItem) {
        const detailsDiv = transactionItem.querySelector('.tx-item-details');
        if (detailsDiv) {
            detailsDiv.classList.toggle('hidden');
        }
    }
});

// HAPUS listener lama untuk 'btn-pay'
// LALU TAMBAHKAN SEMUA LISTENER INI

// Listener untuk tombol "Bayar Tunai" utama
const btnPayCash = document.getElementById('btn-pay-cash');
btnPayCash.addEventListener('click', () => {
    if (cart.length === 0) { alert('Keranjang kosong.'); return; }
    const total = cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    document.getElementById('cash-total-amount').textContent = formatRupiah(total);
    document.getElementById('cash-change-amount').textContent = formatRupiah(0);
    document.getElementById('cash-received-input').value = '';
    document.getElementById('cash-payment-overlay').classList.remove('hidden');
    document.getElementById('cash-received-input').focus();
});

// Listener untuk input uang diterima
const cashReceivedInput = document.getElementById('cash-received-input');
cashReceivedInput.addEventListener('input', () => {
    const total = cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    const received = parseInt(cashReceivedInput.value) || 0;
    const change = received - total;
    document.getElementById('cash-change-amount').textContent = (change >= 0) ? formatRupiah(change) : '-';
});

// Listener untuk tombol batal di modal
const cancelCashBtn = document.getElementById('cancel-cash-btn');
cancelCashBtn.addEventListener('click', () => {
    document.getElementById('cash-payment-overlay').classList.add('hidden');
});

// Listener untuk tombol konfirmasi & cetak
const confirmCashBtn = document.getElementById('confirm-cash-btn');
confirmCashBtn.addEventListener('click', async () => {
    const total = cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    const received = parseInt(cashReceivedInput.value) || 0;
    if (received < total) { alert('Uang yang diterima kurang dari total belanja.'); return; }

    confirmCashBtn.disabled = true;
    confirmCashBtn.textContent = 'Memproses...';

    try {
        // Buat objek paymentInfo di sini
        const paymentInfo = {
            method: 'cash',
            cashAmount: received,
            changeAmount: received - total
        };
        // Panggil finalizeTransaction dengan menyertakan paymentInfo
        const finalTransactionData = await finalizeTransaction(cart, paymentInfo);

        // Panggil printReceipt dengan data lengkap yang dikembalikan
        printReceipt(finalTransactionData);

        // Reset UI
        cart = [];
        localStorage.removeItem('keranjangBelanja');
        renderCart();
        updateAllProductBadges(); // Panggil fungsi baru untuk membersihkan semua badge
        cashPaymentOverlay.classList.add('hidden');
    } catch (error) {
        alert(`Transaksi gagal: ${error.message}`);
    } finally {
        confirmCashBtn.disabled = false;
        confirmCashBtn.textContent = 'Konfirmasi & Cetak';
    }
});

async function initializeApp() {
    await fetchInventory();
    await fetchProducts();
    renderCart();
    fetchTransactions();
    listenForPendingOrders();
    setupSettings(); // <-- Panggil fungsi saklar di sini
}