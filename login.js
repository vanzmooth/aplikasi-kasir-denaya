// PENTING: Salin konfigurasi Firebase Anda dari app.js ke sini
const firebaseConfig = {
    apiKey: "AIzaSyD0Qh1Fimh9iYT8dOi91beIbc1wDe80R0g",
    authDomain: "aplikasikasirpwa.firebaseapp.com",
    projectId: "aplikasikasirpwa",
    storageBucket: "aplikasikasirpwa.firebasestorage.app",
    messagingSenderId: "820452190086",
    appId: "1:820452190086:web:695af51a9d5ac707e22e07"
};

// Inisialisasi Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// Menghubungkan variabel dengan elemen di HTML
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginButton = document.getElementById('login-button');
const errorMessage = document.getElementById('error-message');

// Menambahkan event listener ke tombol login
loginButton.addEventListener('click', () => {
    const email = emailInput.value;
    const password = passwordInput.value;

    // Hapus pesan error sebelumnya
    errorMessage.textContent = '';

    // Validasi sederhana
    if (!email || !password) {
        errorMessage.textContent = 'Email dan password harus diisi.';
        return;
    }

    // Proses login menggunakan Firebase Authentication
    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // Jika login berhasil
            console.log('Login berhasil:', userCredential.user);
            // Arahkan ke halaman kasir utama
            window.location.href = 'index.html';
        })
        // Ganti blok .catch di login.js dengan ini
        .catch((error) => {
            console.error('Login gagal:', error.code);
            switch (error.code) {
                case 'auth/user-not-found':
                    errorMessage.textContent = 'Email tidak terdaftar.';
                    break;
                case 'auth/wrong-password':
                case 'auth/invalid-credential':
                    errorMessage.textContent = 'Password yang Anda masukkan salah.';
                    break;
                case 'auth/invalid-email':
                    errorMessage.textContent = 'Format email tidak valid.';
                    break;
                default:
                    errorMessage.textContent = 'Terjadi error. Coba lagi nanti.';
            }
        });
});

// Tambahkan listener baru ini di login.js
const resetPasswordLink = document.getElementById('reset-password-link');
resetPasswordLink.addEventListener('click', (e) => {
    e.preventDefault(); // Mencegah link berpindah halaman

    const email = emailInput.value;
    if (!email) {
        errorMessage.textContent = 'Masukkan email Anda di atas, lalu klik "Lupa Password?"';
        emailInput.focus();
        return;
    }

    auth.sendPasswordResetEmail(email)
        .then(() => {
            errorMessage.style.color = 'green'; // Ubah warna jadi hijau untuk pesan sukses
            errorMessage.textContent = 'Link reset password telah dikirim ke email Anda. Silakan periksa inbox.';
        })
        .catch((error) => {
            if (error.code === 'auth/user-not-found') {
                errorMessage.textContent = 'Email tidak terdaftar.';
            } else {
                errorMessage.textContent = 'Gagal mengirim email reset. Coba lagi.';
            }
        });
});