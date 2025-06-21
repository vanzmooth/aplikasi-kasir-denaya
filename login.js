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
    const auth = firebase.auth();

    // --- ELEMEN DOM ---
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginButton = document.getElementById('login-button');
    const errorMessage = document.getElementById('error-message');
    const resetPasswordLink = document.getElementById('reset-password-link');

    // --- PENJAGA OTENTIKASI (GATEKEEPER) ---
    auth.onAuthStateChanged(user => {
        if (user) {
            // Jika pengguna sudah login, arahkan ke halaman utama kasir.
            window.location.href = 'index.html';
        }
        // Jika tidak ada user, biarkan di halaman login ini.
    });

    // --- EVENT LISTENER UNTUK TOMBOL LOGIN ---
    loginButton.addEventListener('click', () => {
        const email = emailInput.value;
        const password = passwordInput.value;
        errorMessage.textContent = '';
        errorMessage.style.color = '#dc3545';

        if (!email || !password) {
            errorMessage.textContent = 'Email dan password harus diisi.';
            return;
        }

        auth.signInWithEmailAndPassword(email, password)
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

    // --- EVENT LISTENER UNTUK LINK LUPA PASSWORD ---
    // Pengaman if(element) untuk mencegah error jika elemen tidak ada
    if (resetPasswordLink) {
        resetPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();

            const email = emailInput.value;
            if (!email) {
                errorMessage.textContent = 'Masukkan email Anda di atas, lalu klik "Lupa Password?"';
                emailInput.focus();
                return;
            }

            auth.sendPasswordResetEmail(email)
                .then(() => {
                    errorMessage.style.color = 'green';
                    errorMessage.textContent = 'Link reset password telah dikirim ke email Anda. Silakan periksa inbox.';
                })
                .catch((error) => {
                    errorMessage.style.color = '#dc3545';
                    if (error.code === 'auth/user-not-found') {
                        errorMessage.textContent = 'Email tidak terdaftar.';
                    } else {
                        errorMessage.textContent = 'Gagal mengirim email reset.';
                    }
                });
        });
    }
});