// =======================================================
// CLOUD FUNCTIONS - VERSI FINAL DENGAN onREQUEST + CORS
// =======================================================
const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const midtransClient = require("midtrans-client");

// Konfigurasi CORS yang lebih spesifik
const cors = require("cors")({
    origin: [
        "http://localhost:5500",
        "http://localhost:3000",
        "http://127.0.0.1:5500",
        "https://jajanan-denaya.netlify.app", // ganti dengan domain Anda
        "https://your-domain.com" // ganti dengan domain produksi Anda
    ],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
});

admin.initializeApp();
setGlobalOptions({ region: "asia-southeast2" });

// Inisialisasi Klien Midtrans
const snap = new midtransClient.Snap({
    isProduction: false,
    serverKey: "SB-Mid-server-47mAflFfYOflRYtNDTAl3THJ",
    clientKey: "SB-Mid-client-x4pNw1UvoyxVy9ud",
});

// Fungsi Cloud Function dengan CORS yang benar
exports.createMidtransTransaction = onRequest(async (request, response) => {
    // Jalankan CORS middleware terlebih dahulu
    return new Promise((resolve, reject) => {
        cors(request, response, async (corsError) => {
            if (corsError) {
                console.error("CORS Error:", corsError);
                response.status(500).send({ error: { message: "CORS Error" } });
                reject(corsError);
                return;
            }

            try {
                // Handle preflight OPTIONS request
                if (request.method === "OPTIONS") {
                    response.status(200).send();
                    resolve();
                    return;
                }

                // Pastikan ini adalah metode POST
                if (request.method !== "POST") {
                    response.status(405).send({ error: { message: "Method Not Allowed" } });
                    resolve();
                    return;
                }

                // Ambil data dari request body
                // Untuk onRequest, data bisa langsung di request.body atau request.body.data
                const data = request.body.data || request.body;

                // Validasi data
                if (!data || !data.orderId || !data.totalAmount || !data.customerDetails) {
                    response.status(400).send({
                        error: {
                            message: "Data permintaan tidak lengkap. Diperlukan: orderId, totalAmount, customerDetails"
                        }
                    });
                    resolve();
                    return;
                }

                // Parameter untuk Midtrans
                const parameter = {
                    transaction_details: {
                        order_id: data.orderId,
                        gross_amount: data.totalAmount,
                    },
                    customer_details: {
                        first_name: data.customerDetails.name,
                        email: data.customerDetails.email || "customer@example.com",
                        phone: data.customerDetails.phone || "08123456789",
                    },
                    item_details: data.items || [],
                };

                console.log("Creating transaction with parameter:", parameter);

                // Buat transaksi Midtrans
                const transaction = await snap.createTransaction(parameter);

                // Set header CORS secara manual juga (backup)
                response.set("Access-Control-Allow-Origin", request.headers.origin || "*");
                response.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
                response.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

                // Kirim respons sukses
                response.status(200).json({
                    success: true,
                    data: transaction
                });

                resolve();

            } catch (error) {
                console.error("Error creating Midtrans transaction:", error);

                // Set header CORS untuk error response juga
                response.set("Access-Control-Allow-Origin", request.headers.origin || "*");
                response.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
                response.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

                response.status(500).json({
                    success: false,
                    error: {
                        message: error.message || "Terjadi kesalahan saat membuat transaksi"
                    }
                });

                resolve();
            }
        });
    });
});