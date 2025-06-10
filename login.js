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
        .catch((error) => {
            // Jika login gagal
            console.error('Login gagal:', error);
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                errorMessage.textContent = 'Email atau password salah.';
            } else {
                errorMessage.textContent = 'Terjadi error. Coba lagi nanti.';
            }
        });
});
