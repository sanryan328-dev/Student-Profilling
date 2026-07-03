import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const isProd = process.env.NODE_ENV === "production";
const PORT = 3000;

// Initialize Google GenAI if key is present
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey) {
  try {
    ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
    console.log("✅ Google GenAI successfully initialized server-side.");
  } catch (err) {
    console.error("❌ Failed to initialize Google GenAI:", err);
  }
} else {
  console.log("⚠️ GEMINI_API_KEY not found. Server running without AI capabilities.");
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // --- API Endpoints ---
  app.get("/api/health", (req, res) => {
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      ai_enabled: !!ai,
    });
  });

  // Dynamic Student Profiling via Gemini 3.5 Flash
  app.post("/api/profile-student", async (req, res) => {
    const { student, subjects } = req.body;
    if (!student) {
      return res.status(400).json({ error: "Missing student data" });
    }

    if (!ai) {
      return res.json({
        success: false,
        remarks: "Wali kelas menyarankan agar siswa mempertahankan performa belajarnya. Lakukan latihan mandiri untuk mata pelajaran yang menantang.",
        remedialTips: "Sediakan waktu minimal 30 menit setiap hari untuk mengulang materi pelajaran yang belum tuntas, terutama pada mata pelajaran dengan nilai terendah.",
        careerAdvice: "Disarankan untuk mengeksplorasi minat dan bakat melalui kegiatan ekstrakurikuler serta mempersiapkan kelanjutan studi di tingkat menengah atas sesuai rumpun nilai tertinggi.",
        reason: "AI profiling is currently unavailable because GEMINI_API_KEY is not configured.",
      });
    }

    try {
      const prompt = `
        You are an expert Indonesian Senior Educational Advisor and Child Psychologist.
        Analyze the following student academic performance ledger and provide a deep personalized counseling profile in Indonesian.
        
        Student Details:
        - Nama: ${student.Nama}
        - NISN: ${student.NISN}
        - NIS: ${student.NIS}
        - Status: ${student.Badge}
        - Rata-rata Akademik: ${student["Rata-rata"]}
        - Total Nilai: ${student["Total Nilai"]}
        - Tren Kecepatan Belajar: ${student.Tren_Belajar} poin (Smt3 vs Smt1)
        
        Subject Scores:
        ${JSON.stringify(subjects)}
        
        Non-Academic Details (if available):
        - Sakit: ${student.Sakit || 0} hari
        - Izin: ${student.Izin || 0} hari
        - Alpa (Bolos): ${student.Alpa || 0} hari
        - Pramuka: ${student.Ekskul_Pramuka || "-"}
        - Kesenian: ${student.Ekskul_Kesenian || "-"}
        - Olahraga: ${student.Ekskul_Olahraga || "-"}
        - Catatan BK: ${student["Catatan BK"] || "-"}

        Provide a structured profile containing exactly:
        1. "remarks": A compassionate, specific remark from the Class Teacher (Wali Kelas) in 3-4 sentences regarding their academic and behavioral standing. Mention their highest subjects and areas of growth.
        2. "remedialTips": 2 practical, bite-sized study actions customized specifically to their weaknesses (subjects with lowest scores).
        3. "careerAdvice": High-fidelity path recommendation for high school (SMA MIPA, SOSHUM, or SMK Teknik, Seni, etc.) based on their data. Keep it highly personalized.

        Return strictly a valid JSON object with the keys "remarks", "remedialTips", and "careerAdvice".
        No markdown formatting or outer text backticks, just the raw JSON string.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });

      const responseText = response.text || "{}";
      const parsed = JSON.parse(responseText.trim());
      res.json({
        success: true,
        remarks: parsed.remarks,
        remedialTips: parsed.remedialTips,
        careerAdvice: parsed.careerAdvice,
      });
    } catch (error: any) {
      console.error("Gemini Error:", error);
      res.status(500).json({ error: "Failed to generate AI profiling content", details: error.message });
    }
  });

  // Dynamic Head-to-Head Comparison via Gemini 3.5 Flash
  app.post("/api/compare-students", async (req, res) => {
    const { student1, student2, subjects } = req.body;
    if (!student1 || !student2) {
      return res.status(400).json({ error: "Missing student comparison data" });
    }

    if (!ai) {
      return res.json({
        success: false,
        synergyReport: `Kedua siswa memiliki potensi unik masing-masing. ${student1.Nama} unggul dalam rata-rata nilai, sementara ${student2.Nama} memiliki kecepatan perkembangan yang berbeda. Mereka disarankan melakukan peer-tutoring untuk saling melengkapi materi belajar.`,
        careerAlignment: "Kedua siswa disarankan untuk memetakan minat jurusan SMA/SMK sesuai bidang yang disukai serta membiasakan belajar kelompok secara teratur.",
        reason: "AI Comparison is currently unavailable because GEMINI_API_KEY is not configured.",
      });
    }

    try {
      const prompt = `
        You are an expert Indonesian Educational Consultant.
        Compare the academic profile and learning trajectory of these two students in Indonesian:
        
        Student 1:
        - Nama: ${student1.Nama}
        - Rata-rata: ${student1["Rata-rata"]}
        - Total: ${student1["Total Nilai"]}
        - Tren Kecepatan: ${student1.Tren_Belajar}
        - Subject Scores: ${JSON.stringify(student1)}

        Student 2:
        - Nama: ${student2.Nama}
        - Rata-rata: ${student2["Rata-rata"]}
        - Total: ${student2["Total Nilai"]}
        - Tren Kecepatan: ${student2.Tren_Belajar}
        - Subject Scores: ${JSON.stringify(student2)}

        Analyze their strengths, potential collaboration synergies (peer tutoring / study buddy opportunities), and recommend high school majors where they might align or diverge.
        
        Provide:
        1. "synergyReport": A detailed report of 3 scannable paragraphs about how they compare and how they can tutor each other (Peer Tutoring synergy).
        2. "careerAlignment": Projections of their paths (e.g. if one fits IT/Multimedia and the other is SOSHUM/Sains).
        
        Return strictly a valid JSON object with keys "synergyReport" and "careerAlignment".
        No markdown formatting or outer text backticks, just the raw JSON string.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });

      const responseText = response.text || "{}";
      const parsed = JSON.parse(responseText.trim());
      res.json({
        success: true,
        synergyReport: parsed.synergyReport,
        careerAlignment: parsed.careerAlignment,
      });
    } catch (error: any) {
      console.error("Gemini Error:", error);
      res.status(500).json({ error: "Failed to generate comparison content", details: error.message });
    }
  });

  // Serve static assets or mount Vite dev server
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("⚡ Vite development server middleware mounted.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("🌐 Serving production static files from:", distPath);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 ProPro Ledger Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("💥 Server start failed:", err);
});
