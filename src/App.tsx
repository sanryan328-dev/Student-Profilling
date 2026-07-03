import React, { useState, useEffect, useRef } from "react";
import {
  User,
  Users,
  BookOpen,
  Sparkles,
  RefreshCw,
  Database,
  Search,
  Download,
  Upload,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Award,
  Calendar,
  ShieldAlert,
  FileText,
  CheckCircle2,
  Brain,
  Layers,
  ArrowRightLeft,
  ChevronRight,
  Plus,
  Trash2,
  FileSpreadsheet
} from "lucide-react";
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ScatterChart,
  Scatter,
  ZAxis,
  Cell
} from "recharts";
import * as XLSX from "xlsx";

import { StudentDetail, SubjectStats } from "./types";
import { DEFAULT_STUDENTS, DEFAULT_NAMA_KELAS, DEFAULT_FILE_NAME, SUBJECTS_MAP } from "./defaultData";
import { parseLegerExcel } from "./utils/parser";

export default function App() {
  // State variables
  const [students, setStudents] = useState<StudentDetail[]>(DEFAULT_STUDENTS);
  const [subjects, setSubjects] = useState<string[]>([
    "PAI", "PPKn", "B.IND", "B.ING", "B.SUN", "MTK", "IPA", "IPS", "PJOK", "SENI", "INF"
  ]);
  const [kelasName, setKelasName] = useState<string>(DEFAULT_NAMA_KELAS);
  const [loadedFileName, setLoadedFileName] = useState<string>(DEFAULT_FILE_NAME);
  
  // Navigation tabs
  // "profile" | "compare" | "eval" | "cluster" | "sync" | "database"
  const [activeTab, setActiveTab] = useState<string>("profile");
  
  // Tab 1: Profile Selection
  const [selectedStudentName, setSelectedStudentName] = useState<string>(DEFAULT_STUDENTS[0]?.Nama || "");
  const [profileAiLoading, setProfileAiLoading] = useState<boolean>(false);
  const [aiProfileResult, setAiProfileResult] = useState<{
    remarks?: string;
    remedialTips?: string;
    careerAdvice?: string;
    reason?: string;
  } | null>(null);

  // Tab 2: Comparison Selection
  const [student1Name, setStudent1Name] = useState<string>(DEFAULT_STUDENTS[0]?.Nama || "");
  const [student2Name, setStudent2Name] = useState<string>(DEFAULT_STUDENTS[1]?.Nama || "");
  const [compareAiLoading, setCompareAiLoading] = useState<boolean>(false);
  const [aiCompareResult, setAiCompareResult] = useState<{
    synergyReport?: string;
    careerAlignment?: string;
    reason?: string;
  } | null>(null);

  // Search & Filter in Tab 6 (Database)
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [badgeFilter, setBadgeFilter] = useState<string>("ALL");

  // Sync / Upload files
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [uploadMessage, setUploadMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Sync secondary files state
  const [isAbsensiSynced, setIsAbsensiSynced] = useState<boolean>(false);
  const [isBkSynced, setIsBkSynced] = useState<boolean>(false);

  // --- Dynamic Class Averages ---
  const classAverage = parseFloat(
    (students.reduce((acc, s) => acc + s["Rata-rata"], 0) / students.length).toFixed(2)
  );
  
  const classTrendAverage = parseFloat(
    (students.reduce((acc, s) => acc + s["Tren_Belajar"], 0) / students.length).toFixed(2)
  );

  // Get active student details
  const activeStudent = students.find(s => s.Nama === selectedStudentName) || students[0];

  // --- Trigger Gemini AI Profile ---
  const fetchStudentProfileAi = async (student: StudentDetail) => {
    setProfileAiLoading(true);
    setAiProfileResult(null);
    try {
      // Map exact subjects values for payload
      const subScores: { [key: string]: number } = {};
      subjects.forEach(sub => {
        subScores[sub] = student[sub] || 0;
      });

      const response = await fetch("/api/profile-student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student, subjects: subScores }),
      });
      const data = await response.json();
      setAiProfileResult(data);
    } catch (err) {
      console.error("AI Profiling Error:", err);
      // Fallback
      setAiProfileResult({
        remarks: `Berdasarkan data akademik, ${student.Nama} adalah seorang siswa dengan performa belajarnya yang stabil. Fokus utama pengembangannya ada pada mata pelajaran dengan nilai relatif rendah.`,
        remedialTips: "Berlatih soal-soal latihan secara mandiri di rumah dan membuat agenda belajar kelompok bersama rekan kelas.",
        careerAdvice: "Sangat disarankan melanjutkan penjurusan ke SMA (Rumpun IPS/Sains) atau SMK relevan sesuai potensi kompetensi tertinggi.",
        reason: "Offline Fallback activated."
      });
    } finally {
      setProfileAiLoading(false);
    }
  };

  // --- Trigger Gemini AI Comparison ---
  const fetchStudentComparisonAi = async (s1: StudentDetail, s2: StudentDetail) => {
    setCompareAiLoading(true);
    setAiCompareResult(null);
    try {
      const response = await fetch("/api/compare-students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student1: s1, student2: s2 }),
      });
      const data = await response.json();
      setAiCompareResult(data);
    } catch (err) {
      console.error("AI Compare Error:", err);
      setAiCompareResult({
        synergyReport: `Komparasi antara ${s1.Nama} dan ${s2.Nama} menunjukkan kontras belajar yang menarik. ${s1.Nama} dapat membagikan keahliannya di mata pelajaran dengan skor tinggi kepada ${s2.Nama}, dan sebaliknya untuk melahirkan kerja sama peer-tutoring yang saling melengkapi.`,
        careerAlignment: "Kedua siswa memiliki minat karir yang dinamis dan perlu dibimbing secara terpisah agar optimal dalam pemilihan jurusan SMA/SMK mendatang.",
        reason: "Offline Fallback activated."
      });
    } finally {
      setCompareAiLoading(false);
    }
  };

  // Run AI analysis when active student shifts
  useEffect(() => {
    if (activeStudent) {
      fetchStudentProfileAi(activeStudent);
    }
  }, [selectedStudentName, students]);

  // Run AI comparison when partners shift
  useEffect(() => {
    const s1 = students.find(s => s.Nama === student1Name);
    const s2 = students.find(s => s.Nama === student2Name);
    if (s1 && s2) {
      fetchStudentComparisonAi(s1, s2);
    }
  }, [student1Name, student2Name, students]);

  // --- File Uploader Handlers ---
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = async (file: File) => {
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const data = e.target?.result;
        if (data instanceof ArrayBuffer) {
          const parsed = parseLegerExcel(data);
          if (parsed.students.length > 0) {
            setStudents(parsed.students);
            setSubjects(parsed.subjects);
            setKelasName(parsed.kelasName);
            setLoadedFileName(file.name);
            setSelectedStudentName(parsed.students[0].Nama);
            setStudent1Name(parsed.students[0].Nama);
            setStudent2Name(parsed.students[1]?.Nama || parsed.students[0].Nama);
            setUploadMessage({
              type: "success",
              text: `Berhasil memuat berkas '${file.name}'. Menemukan ${parsed.students.length} siswa dan ${parsed.subjects.length} mata pelajaran!`,
            });
            setIsAbsensiSynced(false);
            setIsBkSynced(false);
          } else {
            setUploadMessage({
              type: "error",
              text: "Gagal mendeteksi data siswa dari lembar nilai. Pastikan format berkas sesuai standar Rapor/Leger.",
            });
          }
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err: any) {
      setUploadMessage({
        type: "error",
        text: `Terjadi kesalahan saat memproses berkas: ${err.message}`,
      });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  // --- Dynamic Excel Exporter (Database) ---
  const handleExportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(
      students.map(s => {
        const row: any = {
          Ranking: s.id,
          Nama: s.Nama,
          NISN: s.NISN,
          NIS: s.NIS,
          Badge: s.Badge,
          "Total Nilai": s["Total Nilai"],
          "Rata-rata": s["Rata-rata"],
          "Tren Belajar (Poin)": s.Tren_Belajar,
          Sakit: s.Sakit || 0,
          Izin: s.Izin || 0,
          Alpa: s.Alpa || 0,
          "Catatan BK": s["Catatan BK"] || "-"
        };
        subjects.forEach(sub => {
          row[SUBJECTS_MAP[sub as keyof typeof SUBJECTS_MAP] || sub] = s[sub] || 0;
        });
        return row;
      })
    );

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, kelasName.substring(0, 30));
    XLSX.writeFile(wb, `Database_Leder_${kelasName.replace(/\s+/g, "_")}.xlsx`);
  };

  // --- Generate Templates ---
  const triggerDownloadTemplate = (type: "absensi" | "bk") => {
    const wb = XLSX.utils.book_new();
    const headers = type === "absensi" 
      ? ["No", "Nama Siswa", "NIS", "Sakit", "Izin", "Alpa", "Pramuka", "Kesenian", "Olahraga"]
      : ["No", "Nama Siswa", "NIS", "Jml Pelanggaran", "Catatan BK"];
    
    const rows = students.map((s, idx) => {
      return type === "absensi"
        ? [idx + 1, s.Nama, s.NIS, 0, 0, 0, "B", "-", "B"]
        : [idx + 1, s.Nama, s.NIS, 0, "-"];
    });

    const wsData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, type === "absensi" ? "Data Absensi" : "Catatan BK");
    XLSX.writeFile(wb, `Template_${type === "absensi" ? "Absensi" : "Catatan_BK"}_${kelasName.replace(/\s+/g, "_")}.xlsx`);
  };

  // --- Dynamic Secondary Sync File ---
  const handleSecondaryUpload = (e: React.ChangeEvent<HTMLInputElement>, type: "absensi" | "bk") => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = evt.target?.result;
          if (data instanceof ArrayBuffer) {
            const workbook = XLSX.read(data, { type: "array" });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const json: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            
            // Find header columns to match
            const headers = json[0].map(h => String(h).toUpperCase().trim());
            const nisIdx = headers.indexOf("NIS");
            
            if (nisIdx === -1) {
              alert("Berkas sekunder harus memiliki kolom 'NIS' agar sinkronisasi data presisi!");
              return;
            }

            const updatedStudents = students.map(student => {
              const matchedRow = json.slice(1).find(row => String(row[nisIdx]).trim() === String(student.NIS).trim());
              if (matchedRow) {
                if (type === "absensi") {
                  const sakitIdx = headers.indexOf("SAKIT");
                  const izinIdx = headers.indexOf("IZIN");
                  const alpaIdx = headers.indexOf("ALPA");
                  const pramukaIdx = headers.indexOf("PRAMUKA");
                  const kesenianIdx = headers.indexOf("KESENIAN");
                  const olahragaIdx = headers.indexOf("OLAHRAGA");

                  const s = parseInt(matchedRow[sakitIdx]) || 0;
                  const i = parseInt(matchedRow[izinIdx]) || 0;
                  const a = parseInt(matchedRow[alpaIdx]) || 0;
                  const absTotal = 120 - (s + i + a);
                  const disciplineScore = Math.max(0, parseFloat(((absTotal / 120) * 100).toFixed(2)) - (a * 4));

                  return {
                    ...student,
                    Sakit: s,
                    Izin: i,
                    Alpa: a,
                    Ekskul_Pramuka: matchedRow[pramukaIdx] ? String(matchedRow[pramukaIdx]) : student.Ekskul_Pramuka,
                    Ekskul_Kesenian: matchedRow[kesenianIdx] ? String(matchedRow[kesenianIdx]) : student.Ekskul_Kesenian,
                    Ekskul_Olahraga: matchedRow[olahragaIdx] ? String(matchedRow[olahragaIdx]) : student.Ekskul_Olahraga,
                    Skor_Disiplin: disciplineScore
                  };
                } else {
                  const bkIdx = headers.indexOf("CATATAN BK");
                  const pelIdx = headers.indexOf("JML PELANGGARAN");
                  
                  return {
                    ...student,
                    "Catatan BK": matchedRow[bkIdx] ? String(matchedRow[bkIdx]) : student["Catatan BK"],
                    "Jml Pelanggaran": matchedRow[pelIdx] ? parseInt(matchedRow[pelIdx]) : 0
                  };
                }
              }
              return student;
            });

            setStudents(updatedStudents);
            if (type === "absensi") {
              setIsAbsensiSynced(true);
            } else {
              setIsBkSynced(true);
            }
            alert(`Berhasil mensinkronkan ${type === "absensi" ? "Data Absensi & Ekskul" : "Catatan BK"} ke database kelas!`);
          }
        } catch (err: any) {
          alert(`Gagal mensinkronkan data: ${err.message}`);
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  // --- Tab 3: Subject Evaluations Class Analysis ---
  const subjectStats: SubjectStats[] = subjects.map(sub => {
    const total = students.reduce((acc, s) => acc + (s[sub] || 0), 0);
    return {
      subject: sub,
      average: parseFloat((total / students.length).toFixed(2))
    };
  }).sort((a, b) => a.average - b.average); // Hardest first

  // --- Tab 4: Client-side K-Means clustering algorithm ---
  const runStudentClustering = () => {
    // 3 clusters: Akselerasi (Atas), Berkembang (Menengah), Fokus Bimbingan (Bawah)
    // Run simple k-means logic
    const inputData = students.map(s => ({
      average: s["Rata-rata"],
      trend: s.Tren_Belajar,
      student: s
    }));

    // Centroids initialization
    let centroids = [
      { average: 74, trend: 0 }, // Low / Fokus
      { average: 81, trend: 2.5 }, // Mid / Berkembang
      { average: 86, trend: 5.0 }  // High / Akselerasi
    ];

    let clusters: { name: string; color: string; students: StudentDetail[] }[] = [
      { name: "🎯 Fokus Bimbingan Intensif", color: "#f43f5e", students: [] },
      { name: "📈 Kelompok Berkembang", color: "#3b82f6", students: [] },
      { name: "🌟 Kelompok Akselerasi", color: "#10b981", students: [] }
    ];

    inputData.forEach(p => {
      let minDist = Infinity;
      let clusterIdx = 0;
      for (let c = 0; c < centroids.length; c++) {
        const d = Math.pow(p.average - centroids[c].average, 2) + Math.pow(p.trend - centroids[c].trend, 2);
        if (d < minDist) {
          minDist = d;
          clusterIdx = c;
        }
      }
      clusters[clusterIdx].students.push(p.student);
    });

    return clusters;
  };

  const clusterResult = runStudentClustering();

  // --- Tab 6: Filtered & Sorted Students ---
  const filteredStudents = students.filter(s => {
    const matchesSearch = s.Nama.toUpperCase().includes(searchQuery.toUpperCase()) ||
                          s.NISN.includes(searchQuery) ||
                          s.NIS.includes(searchQuery);
    
    if (badgeFilter === "ALL") return matchesSearch;
    if (badgeFilter === "HIGH") return matchesSearch && s.Badge === "🌟 High Achiever";
    if (badgeFilter === "STABIL") return matchesSearch && s.Badge === "✅ Stabil";
    if (badgeFilter === "FOKUS") return matchesSearch && s.Badge === "🆘 Fokus Perbaikan";
    return matchesSearch;
  });

  // Calculate High School Career Recommendations scores (Hybrid Intelligence)
  const getCareerRecommendations = (student: StudentDetail) => {
    const mtk = student.MTK || 0;
    const ipa = student.IPA || 0;
    const ips = student.IPS || 0;
    const bind = student["B.IND"] || 0;
    const bing = student["B.ING"] || 0;
    const inf = student.INF || 0;
    const seni = student.SENI || 0;

    const bonusPramuka = student.Ekskul_Pramuka === "A" ? 5 : student.Ekskul_Pramuka === "B" ? 2 : 0;
    const bonusSeni = student.Ekskul_Kesenian === "A" ? 5 : student.Ekskul_Kesenian === "B" ? 2 : 0;
    const bonusOlahraga = student.Ekskul_Olahraga === "A" ? 5 : student.Ekskul_Olahraga === "B" ? 2 : 0;

    const tracks = [
      {
        name: "SMA: Matematika & Ilmu Pengetahuan Alam (MIPA)",
        score: ((mtk + ipa) / 2) + (bonusPramuka * 0.5),
        desc: "Unggul dalam rumpun logika sains, pemecahan masalah kuantitatif, dan eksplorasi alam.",
        color: "bg-indigo-50 border-indigo-100 text-indigo-700"
      },
      {
        name: "SMA: Ilmu Pengetahuan Sosial (SOSHUM)",
        score: ((ips + bind) / 2) + (bonusPramuka * 0.5),
        desc: "Unggul dalam ilmu kemasyarakatan, analisa sosial, tata hukum, dan kecakapan interpersonal.",
        color: "bg-emerald-50 border-emerald-100 text-emerald-700"
      },
      {
        name: "SMA: Bahasa, Sastra & Hubungan Internasional",
        score: ((bind + bing) / 2) + (bonusSeni * 0.3),
        desc: "Kecerdasan bahasa tinggi, komunikasi efektif, pemahaman budaya, dan diplomasi internasional.",
        color: "bg-amber-50 border-amber-100 text-amber-700"
      },
      {
        name: "SMK: Teknologi Informasi & Rekayasa Perangkat Lunak",
        score: ((inf + mtk + bing) / 3) + (bonusOlahraga * 0.2),
        desc: "Kecakapan tinggi di sistem komputasi, algoritma pemrograman, jaringan, dan pengembangan IT.",
        color: "bg-cyan-50 border-cyan-100 text-cyan-700"
      },
      {
        name: "SMK: Industri Seni Kreatif, Seni Rupa & Desain",
        score: ((seni + inf) / 2) + bonusSeni,
        desc: "Ekspresi visual orisinil, keterampilan estetik, multimedia, dan industri kriya/kreatif.",
        color: "bg-rose-50 border-rose-100 text-rose-700"
      }
    ];

    return tracks.sort((a, b) => b.score - a.score);
  };

  // Highlight comparison cells
  const getComparisonDifference = (v1: number, v2: number) => {
    const diff = v2 - v1;
    if (diff > 0) return { text: `+${diff.toFixed(2)}`, color: "text-emerald-600 bg-emerald-50" };
    if (diff < 0) return { text: `${diff.toFixed(2)}`, color: "text-rose-600 bg-rose-50" };
    return { text: "0.00", color: "text-slate-400 bg-slate-100" };
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 overflow-x-hidden select-none">
      
      {/* Hidden input for primary file upload from header, sync page, or database controls */}
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileInputChange}
        accept=".xlsx,.xls,.csv,.ods"
        className="hidden"
      />

      {/* Header Bar */}
      <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-30 no-print shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-sm">
            P
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight text-slate-900 flex items-center gap-1.5">
              Pro-Edu Ledger Analytics
              <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">v1.2</span>
            </h1>
            <p className="text-[10px] text-slate-500 font-medium font-sans">
              Dynamic Class Profiling & Trajectory Predictor
            </p>
          </div>
        </div>

        {/* Interactive Loaded File / Premium Uploader */}
        <div className="hidden sm:flex items-center gap-3 bg-slate-50 border border-slate-200/60 p-1 rounded-full pl-3.5 pr-2 shadow-2xs">
          <div className="flex items-center gap-1.5">
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-[11px] font-bold text-slate-600 truncate max-w-[130px]" title={loadedFileName}>
              {loadedFileName}
            </span>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer shadow-xs hover:shadow-sm"
          >
            <Upload className="w-2.5 h-2.5" />
            Ganti Leger
          </button>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="text-right hidden md:block">
            <p className="text-xs font-bold text-slate-800">{kelasName}</p>
            <p className="text-[9px] text-slate-400 font-medium">SMP Negeri 1 Wanayasa</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs border border-indigo-200">
            {kelasName.includes("VIII") ? "8F" : "ED"}
          </div>
        </div>
      </header>

      {/* Overview Stat Widgets */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-6 pt-5 no-print">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Siswa</p>
            <p className="text-xl font-extrabold text-slate-900">{students.length}</p>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Rata-rata Kelas</p>
            <p className="text-xl font-extrabold text-slate-900">{classAverage}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Kecepatan Belajar</p>
            <p className="text-xl font-extrabold text-slate-900">
              {classTrendAverage >= 0 ? `+${classTrendAverage}` : classTrendAverage} Poin
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Status Integrasi</p>
            <div className="flex gap-1.5 mt-0.5">
              <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${isAbsensiSynced ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                Absen {isAbsensiSynced ? "OK" : "NO"}
              </span>
              <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${isBkSynced ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-500"}`}>
                BK {isBkSynced ? "OK" : "NO"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <main className="flex-1 p-6 flex flex-col gap-6 md:pb-24">
        
        {/* TAB NAVIGATION FOR DESKTOP */}
        <div className="flex justify-start border-b border-slate-200 gap-1.5 no-print overflow-x-auto pb-px">
          {[
            { id: "profile", label: "👤 Profil Siswa", desc: "Detail & AI Advice" },
            { id: "compare", label: "⚖️ Komparasi", desc: "Head-to-Head VS" },
            { id: "eval", label: "📚 Evaluasi Mapel", desc: "Tingkat Kesulitan" },
            { id: "cluster", label: "🤖 AI Klaster", desc: "Grouping K-Means" },
            { id: "sync", label: "🔄 Sync Data", desc: "Excel & Absensi BK" },
            { id: "database", label: "📊 Database Kelas", desc: "Ledger Sheet" }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-3 text-xs font-semibold rounded-t-xl transition-all duration-200 border-t border-x -mb-px flex flex-col items-start gap-0.5 ${
                activeTab === tab.id
                  ? "bg-white border-slate-200 text-indigo-600 shadow-xs"
                  : "bg-transparent border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100"
              }`}
            >
              <span>{tab.label}</span>
              <span className="text-[9px] font-medium text-slate-400 uppercase tracking-wider">{tab.desc}</span>
            </button>
          ))}
        </div>

        {/* TAB CONTENTS */}
        <div className="flex-1">
          
          {/* ==============================================
              1. STUDENT PROFILE & ADVANCED AI ADVICE 
              ============================================== */}
          {activeTab === "profile" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Left Selector & Basic Card */}
              <div className="lg:col-span-4 flex flex-col gap-6">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">Cari Profil Siswa:</label>
                  <div className="relative">
                    <select
                      value={selectedStudentName}
                      onChange={(e) => setSelectedStudentName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all duration-200"
                    >
                      {students.map(s => (
                        <option key={s.Nama} value={s.Nama}>
                          {s.Nama}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Profile Card */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                  <div className="p-6 bg-gradient-to-br from-indigo-50 to-slate-50 border-b border-slate-100">
                    <div className="flex justify-between items-start gap-2 mb-3">
                      <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${
                        activeStudent?.Badge.includes("High") 
                          ? "bg-emerald-100 text-emerald-700 border border-emerald-200" 
                          : activeStudent?.Badge.includes("Stabil") 
                          ? "bg-indigo-100 text-indigo-700 border border-indigo-200"
                          : "bg-rose-100 text-rose-700 border border-rose-200"
                      }`}>
                        {activeStudent?.Badge}
                      </span>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 font-bold block">PERINGKAT</span>
                        <span className="text-lg font-extrabold text-slate-800">
                          #{students.findIndex(s => s.Nama === activeStudent?.Nama) + 1}
                        </span>
                        <span className="text-xs text-slate-400 font-medium block">dari {students.length} siswa</span>
                      </div>
                    </div>
                    
                    <h2 className="text-lg font-bold text-slate-900 tracking-tight">{activeStudent?.Nama}</h2>
                    <div className="grid grid-cols-2 gap-2 mt-4 text-[11px] text-slate-500">
                      <div>
                        <span className="font-bold text-slate-400 block uppercase tracking-wider">NISN:</span>
                        <span className="font-mono text-slate-700 font-semibold">{activeStudent?.NISN}</span>
                      </div>
                      <div>
                        <span className="font-bold text-slate-400 block uppercase tracking-wider">NIS:</span>
                        <span className="font-mono text-slate-700 font-semibold">{activeStudent?.NIS}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 grid grid-cols-3 gap-3 text-center border-b border-slate-100">
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <p className="text-sm font-extrabold text-indigo-600">{activeStudent?.["Rata-rata"]}</p>
                      <p className="text-[9px] text-slate-400 font-bold">Rerata Nilai</p>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <p className="text-sm font-extrabold text-slate-800">{activeStudent?.["Total Nilai"]}</p>
                      <p className="text-[9px] text-slate-400 font-bold">Total Nilai</p>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <p className={`text-sm font-extrabold flex items-center justify-center gap-0.5 ${
                        activeStudent?.Tren_Belajar >= 0 ? "text-emerald-600" : "text-rose-600"
                      }`}>
                        {activeStudent?.Tren_Belajar >= 0 ? "+" : ""}{activeStudent?.Tren_Belajar}
                      </p>
                      <p className="text-[9px] text-slate-400 font-bold">Tren Belajar</p>
                    </div>
                  </div>

                  {/* Discipline Mini Recap */}
                  <div className="p-6 flex flex-col gap-3">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Kedisiplinan & Pengembangan Diri</h3>
                    {isAbsensiSynced ? (
                      <div className="space-y-2.5">
                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                          <div className="bg-amber-50 p-1.5 rounded-lg text-amber-700 border border-amber-100">
                            <span className="font-bold block">{activeStudent?.Sakit}</span>
                            <span className="text-[9px] font-medium">Sakit</span>
                          </div>
                          <div className="bg-blue-50 p-1.5 rounded-lg text-blue-700 border border-blue-100">
                            <span className="font-bold block">{activeStudent?.Izin}</span>
                            <span className="text-[9px] font-medium">Izin</span>
                          </div>
                          <div className="bg-rose-50 p-1.5 rounded-lg text-rose-700 border border-rose-100">
                            <span className="font-bold block">{activeStudent?.Alpa}</span>
                            <span className="text-[9px] font-medium">Alpa</span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <span className="text-slate-500 font-medium">Skor Disiplin Kehadiran</span>
                          <span className="font-bold text-indigo-600">{activeStudent?.Skor_Disiplin}%</span>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-slate-50 border border-slate-200/50 p-3.5 rounded-xl text-center">
                        <AlertTriangle className="w-5 h-5 text-amber-500 mx-auto mb-1.5" />
                        <p className="text-[10px] text-slate-500 font-medium">
                          Data absensi & pengembangan belum diunggah. Unggah berkas di tab <b>Sync Data</b>.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Print button */}
                <button
                  onClick={() => window.print()}
                  className="w-full bg-slate-800 text-white font-semibold text-xs py-3 px-4 rounded-xl shadow-xs hover:bg-slate-900 transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Cetak Laporan Profil (PDF)
                </button>
              </div>

              {/* Right Side: Radar Chart & Advice */}
              <div className="lg:col-span-8 flex flex-col gap-6">
                
                {/* Radar Competency Map */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-6">
                  <div className="flex-1 w-full h-[280px]">
                    <h3 className="text-sm font-bold text-slate-800 mb-4 tracking-tight">Peta Kompetensi Akademik</h3>
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart
                        cx="50%"
                        cy="50%"
                        outerRadius="75%"
                        data={subjects.map(sub => ({
                          subject: sub,
                          score: activeStudent[sub] || 0
                        }))}
                      >
                        <PolarGrid stroke="#e2e8f0" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: "#64748b", fontSize: 10, fontWeight: 600 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 8 }} />
                        <Radar
                          name={activeStudent.Nama}
                          dataKey="score"
                          stroke="#4f46e5"
                          fill="#4f46e5"
                          fillOpacity={0.2}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Career recommendation vector */}
                  <div className="w-full md:w-80 flex flex-col gap-4 self-stretch justify-between bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                    <div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2.5">Kekuatan Terpilih (Kecerdasan Hibrida)</h4>
                      <div className="space-y-2">
                        {getCareerRecommendations(activeStudent).slice(0, 3).map((rec, i) => (
                          <div key={rec.name} className="flex flex-col gap-0.5 text-xs">
                            <div className="flex justify-between font-bold text-slate-700">
                              <span className="truncate max-w-[200px]">{rec.name.split(":")[1] || rec.name}</span>
                              <span className="text-indigo-600">{(rec.score).toFixed(1)} Poin</span>
                            </div>
                            <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden">
                              <div className="bg-indigo-600 h-1" style={{ width: `${Math.min(100, rec.score)}%` }}></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium italic mt-2">
                      *Dihitung otomatis melalui formulir bobot nilai rumpun akademik utama dan predikat pengembangan bakat.
                    </div>
                  </div>
                </div>

                {/* Gemini-powered recommendations */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      Rekomendasi Cerdas AI (Gemini 3.5 Flash)
                    </h3>
                    <span className="text-[10px] text-slate-400 font-medium">Bimbingan Terarah</span>
                  </div>

                  <div className="p-6 flex flex-col gap-5">
                    {profileAiLoading ? (
                      <div className="py-12 text-center flex flex-col items-center justify-center gap-3">
                        <RefreshCw className="w-7 h-7 text-indigo-600 animate-spin" />
                        <p className="text-xs font-bold text-slate-500">Menganalisa profil & merumuskan saran belajar khusus...</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        
                        {/* Remarks */}
                        <div className="flex flex-col gap-2">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-slate-400" />
                            Interpretasi Wali Kelas
                          </h4>
                          <div className="p-4 bg-indigo-50/50 border border-indigo-100/50 rounded-xl">
                            <p className="text-xs text-slate-700 leading-relaxed font-sans font-medium">
                              {aiProfileResult?.remarks}
                            </p>
                          </div>
                        </div>

                        {/* Remedial Advice */}
                        <div className="flex flex-col gap-2">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                            <Brain className="w-3.5 h-3.5 text-slate-400" />
                            Area Fokus Perbaikan (Remedial)
                          </h4>
                          <div className="p-4 bg-rose-50/50 border border-rose-100/50 rounded-xl">
                            <p className="text-xs text-slate-700 leading-relaxed font-sans font-medium">
                              {aiProfileResult?.remedialTips}
                            </p>
                          </div>
                        </div>

                        {/* Career Guidance */}
                        <div className="md:col-span-2 flex flex-col gap-2">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-slate-400" />
                            Rekomendasi Lanjutan & Trajektori Karir
                          </h4>
                          <div className="p-4 bg-emerald-50/40 border border-emerald-100/40 rounded-xl">
                            <p className="text-xs text-slate-700 leading-relaxed font-sans font-medium">
                              {aiProfileResult?.careerAdvice}
                            </p>
                          </div>
                        </div>

                      </div>
                    )}
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* ==============================================
              2. HEAD-TO-HEAD COMPARISON 
              ============================================== */}
          {activeTab === "compare" && (
            <div className="flex flex-col gap-6">
              
              {/* Selectors */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">Siswa 1:</label>
                  <select
                    value={student1Name}
                    onChange={(e) => setStudent1Name(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800"
                  >
                    {students.map(s => (
                      <option key={s.Nama} value={s.Nama} disabled={s.Nama === student2Name}>
                        {s.Nama}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">Siswa 2:</label>
                  <select
                    value={student2Name}
                    onChange={(e) => setStudent2Name(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800"
                  >
                    {students.map(s => (
                      <option key={s.Nama} value={s.Nama} disabled={s.Nama === student1Name}>
                        {s.Nama}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Charts & Table layout */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* Polar Comparison Chart */}
                <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-[320px]">
                  <h3 className="text-sm font-bold text-slate-800 mb-4">Sandingan Radar Kompetensi</h3>
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart
                      cx="50%"
                      cy="50%"
                      outerRadius="75%"
                      data={subjects.map(sub => {
                        const s1 = students.find(x => x.Nama === student1Name);
                        const s2 = students.find(x => x.Nama === student2Name);
                        return {
                          subject: sub,
                          [student1Name.split(" ")[0]]: s1 ? (s1[sub] || 0) : 0,
                          [student2Name.split(" ")[0]]: s2 ? (s2[sub] || 0) : 0
                        };
                      })}
                    >
                      <PolarGrid stroke="#e2e8f0" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: "#64748b", fontSize: 10, fontWeight: 600 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} />
                      <Radar
                        name={student1Name.split(" ")[0]}
                        dataKey={student1Name.split(" ")[0]}
                        stroke="#4f46e5"
                        fill="#4f46e5"
                        fillOpacity={0.15}
                      />
                      <Radar
                        name={student2Name.split(" ")[0]}
                        dataKey={student2Name.split(" ")[0]}
                        stroke="#ec4899"
                        fill="#ec4899"
                        fillOpacity={0.15}
                      />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>

                {/* Subject Scores Matrix Table */}
                <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100">
                    <h3 className="font-bold text-slate-800 text-sm">Metrik Nilai Bandingan</h3>
                  </div>
                  <div className="overflow-x-auto max-h-[260px] overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-slate-50/20">
                          <th className="px-6 py-3">Mata Pelajaran</th>
                          <th className="px-6 py-3 text-center">{student1Name.split(" ")[0]}</th>
                          <th className="px-6 py-3 text-center">{student2Name.split(" ")[0]}</th>
                          <th className="px-6 py-3 text-center">Selisih</th>
                        </tr>
                      </thead>
                      <tbody className="text-xs divide-y divide-slate-100 font-sans">
                        {subjects.map(sub => {
                          const s1Val = students.find(x => x.Nama === student1Name)?.[sub] || 0;
                          const s2Val = students.find(x => x.Nama === student2Name)?.[sub] || 0;
                          const diff = getComparisonDifference(s1Val, s2Val);
                          return (
                            <tr key={sub} className="hover:bg-slate-50/50">
                              <td className="px-6 py-3 font-semibold text-slate-700">{SUBJECTS_MAP[sub as keyof typeof SUBJECTS_MAP] || sub}</td>
                              <td className="px-6 py-3 text-center font-bold text-slate-800">{s1Val}</td>
                              <td className="px-6 py-3 text-center font-bold text-slate-800">{s2Val}</td>
                              <td className="px-6 py-3 text-center">
                                <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${diff.color}`}>
                                  {diff.text}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>

              {/* Predictive AI Comparison Insight */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <ArrowRightLeft className="w-4 h-4 text-indigo-600" />
                    Analisa Sinergi & Komparasi Akademis (AI Gemini)
                  </h3>
                  <span className="text-[10px] text-slate-400 font-medium">Peer Tutoring Strategy</span>
                </div>
                <div className="p-6">
                  {compareAiLoading ? (
                    <div className="py-12 text-center flex flex-col items-center justify-center gap-3">
                      <RefreshCw className="w-7 h-7 text-indigo-600 animate-spin" />
                      <p className="text-xs font-bold text-slate-500">Menghitung matriks korelasi & merumuskan sinergi teman sebaya...</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="flex flex-col gap-2">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Peluang Kerja Sama (Study Buddy)</h4>
                        <div className="p-4 bg-indigo-50/50 border border-indigo-100/50 rounded-xl text-xs leading-relaxed text-slate-700">
                          {aiCompareResult?.synergyReport}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Sinergi & Penyelarasan Karir</h4>
                        <div className="p-4 bg-emerald-50/40 border border-emerald-100/40 rounded-xl text-xs leading-relaxed text-slate-700">
                          {aiCompareResult?.careerAlignment}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* ==============================================
              3. SUBJECT DIFFICULTY EVALUATIONS 
              ============================================== */}
          {activeTab === "eval" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 mb-4">Nilai Rata-rata Kelas per Mata Pelajaran</h3>
                <div className="w-full h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={subjectStats}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} stroke="#f1f5f9" />
                      <XAxis type="number" domain={[0, 100]} stroke="#94a3b8" fontSize={10} />
                      <YAxis dataKey="subject" type="category" stroke="#94a3b8" fontSize={10} width={60} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: "#1e293b", color: "#fff", borderRadius: 10, border: "none" }}
                        itemStyle={{ color: "#fff" }}
                      />
                      <Bar dataKey="average" radius={[0, 10, 10, 0]} barSize={16}>
                        {subjectStats.map((entry, index) => {
                          const isHardest = index < 3;
                          return (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={isHardest ? "#f43f5e" : index > subjectStats.length - 4 ? "#10b981" : "#4f46e5"} 
                            />
                          );
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Informative explanation text */}
              <div className="lg:col-span-5 flex flex-col gap-5">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Evaluasi Tingkat Kesulitan Mapel</h3>
                  <div className="space-y-4">
                    <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl">
                      <p className="text-xs font-bold text-rose-700 flex items-center gap-1.5 mb-1">
                        <ShieldAlert className="w-4 h-4" />
                        Tantangan Terbesar Kelas (Nilai Terendah)
                      </p>
                      <p className="text-[11px] text-rose-600 font-medium">
                        Siswa secara makro paling terhambat pada: <b>{subjectStats.slice(0, 3).map(s => s.subject).join(", ")}</b>.
                        Direkomendasikan alokasi jam penguatan materi remedial tambahan pada rumpun ini.
                      </p>
                    </div>

                    <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                      <p className="text-xs font-bold text-emerald-700 flex items-center gap-1.5 mb-1">
                        <CheckCircle2 className="w-4 h-4" />
                        Potensi Unggulan Terbesar Kelas
                      </p>
                      <p className="text-[11px] text-emerald-600 font-medium">
                        Siswa paling menguasai: <b>{subjectStats.slice(-3).reverse().map(s => s.subject).join(", ")}</b>.
                        Rerata nilai berada dalam level prima. Bidang ini bisa menjadi tumpuan utama akselerasi belajar rekan-rekan sebaya.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-2">
                  <h4 className="text-xs font-bold text-slate-800 tracking-tight">Kamus Singkatan Mapel:</h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[10px] text-slate-500 font-medium">
                    {Object.entries(SUBJECTS_MAP).map(([abbr, full]) => (
                      <div key={abbr}>
                        <b className="text-slate-800">{abbr}</b>: {full}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ==============================================
              4. MACHINE LEARNING K-MEANS CLUSTERING 
              ============================================== */}
          {activeTab === "cluster" && (
            <div className="flex flex-col gap-6">
              
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 mb-1">Klasterisasi K-Means Berbasis Trajektori Perkembangan</h3>
                <p className="text-xs text-slate-500">
                  Secara cerdas membagi 3 kelompok belajar adaptif berdasarkan Rata-rata Nilai (Koordinat X) dan Tren Kecepatan Perkembangan Belajar (Koordinat Y).
                </p>
              </div>

              {/* Scatter Plot Visualizer */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                <div className="lg:col-span-8 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Grafik Sebaran Siswa Adaptif</h3>
                  <div className="w-full h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis type="number" dataKey="average" name="Rata-rata" unit=" " stroke="#94a3b8" fontSize={10} domain={[70, 100]} />
                        <YAxis type="number" dataKey="trend" name="Tren Belajar" unit=" " stroke="#94a3b8" fontSize={10} />
                        <ZAxis type="number" dataKey="size" range={[60, 400]} />
                        <Tooltip 
                          cursor={{ strokeDasharray: '3 3' }} 
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className="bg-slate-900 text-white p-3 rounded-lg text-xs shadow-md border-none">
                                  <p className="font-bold">{data.name}</p>
                                  <p>Rerata: {data.average}</p>
                                  <p>Tren: {data.trend >= 0 ? "+" : ""}{data.trend} Poin</p>
                                  <p className="text-[10px] text-indigo-300 font-bold mt-1 uppercase tracking-wider">{data.groupName}</p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Legend />
                        {clusterResult.map((cluster, cIdx) => (
                          <Scatter
                            key={cluster.name}
                            name={cluster.name}
                            data={cluster.students.map(s => ({
                              average: s["Rata-rata"],
                              trend: s.Tren_Belajar,
                              size: 150,
                              name: s.Nama,
                              groupName: cluster.name
                            }))}
                            fill={cluster.color}
                          />
                        ))}
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Group Tables */}
                <div className="lg:col-span-4 flex flex-col gap-4">
                  {clusterResult.map((cluster) => (
                    <div key={cluster.name} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between" style={{ borderLeft: `4px solid ${cluster.color}` }}>
                        <h4 className="text-xs font-bold text-slate-800">{cluster.name}</h4>
                        <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-full">
                          {cluster.students.length} Siswa
                        </span>
                      </div>
                      <div className="p-3 max-h-[120px] overflow-y-auto">
                        <div className="grid grid-cols-1 gap-1">
                          {cluster.students.map(student => (
                            <div key={student.Nama} className="flex justify-between items-center text-xs py-1 px-1.5 rounded-md hover:bg-slate-50">
                              <span className="truncate max-w-[160px] font-medium text-slate-700">{student.Nama}</span>
                              <span className="font-bold text-slate-500">{student["Rata-rata"]}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

              </div>

            </div>
          )}

          {/* ==============================================
              5. SYNC SECONDARY FILES & DATA EXPORTERS 
              ============================================== */}
          {activeTab === "sync" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Primary Uploader */}
              <div className="lg:col-span-7 flex flex-col gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-800 mb-1">Unggah Dokumen Leger Utama</h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Sistem akan mendeteksi otomatis struktur file <b>'f_legersemua_Kelas VIII F (4).xlsx'</b>, menyaring headers bertingkat, dan menstandarkan NISN menjadi 10 digit.
                  </p>

                  <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 ${
                      dragActive 
                        ? "border-indigo-500 bg-indigo-50/50" 
                        : "border-slate-200 hover:border-indigo-400 bg-slate-50/50 hover:bg-slate-50"
                    }`}
                  >
                    <Upload className="w-8 h-8 text-indigo-500 mx-auto mb-3" />
                    <p className="text-xs font-bold text-slate-700 mb-1">
                      Klik untuk Telusuri Berkas atau Seret & Lepaskan di Sini
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Mendukung .xlsx, .xls, .ods, dan .csv
                    </p>
                  </div>

                  {uploadMessage && (
                    <div className={`mt-4 p-4 rounded-xl text-xs font-medium flex items-start gap-2 border ${
                      uploadMessage.type === "success" 
                        ? "bg-emerald-50 border-emerald-100 text-emerald-800" 
                        : "bg-rose-50 border-rose-100 text-rose-800"
                    }`}>
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{uploadMessage.text}</span>
                    </div>
                  )}
                </div>

                {/* Instructions on dynamic structure handling */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Bagaimana Struktur Fleksibel Bekerja?</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-medium text-slate-600">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <h4 className="font-bold text-slate-800 mb-1">1. Deteksi Kelas</h4>
                      <p className="text-[11px] text-slate-400 leading-relaxed">Pencarian cerdas teks "KELAS" di baris awal untuk menamai dashboard secara otomatis.</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <h4 className="font-bold text-slate-800 mb-1">2. Multi-header Filter</h4>
                      <p className="text-[11px] text-slate-400 leading-relaxed">Menyaring nama mata pelajaran di atas baris sub-kolom "Smt" untuk memisahkan data kognitif murni.</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <h4 className="font-bold text-slate-800 mb-1">3. Standarisasi NISN</h4>
                      <p className="text-[11px] text-slate-400 leading-relaxed">Menghapus angka desimal gantung ".0" dan melengkapi deret angka berawalan nol (10-Digit).</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Secondary sync section */}
              <div className="lg:col-span-5 flex flex-col gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-800 mb-1">Sinkronisasi Kehadiran & BK</h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Unduh template berurutan rapat yang dirancang agar meminimalisir kesalahan input ketik siswa.
                  </p>

                  <div className="space-y-4">
                    {/* Template 1 */}
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col gap-3">
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="text-xs font-bold text-slate-800">Template Kehadiran & Ekskul</h4>
                          <p className="text-[10px] text-slate-400">Tersusun rapat No, Nama, NIS, Sakit, Izin, Alpa</p>
                        </div>
                        <button
                          onClick={() => triggerDownloadTemplate("absensi")}
                          className="p-2 bg-white rounded-lg border border-slate-200 hover:bg-slate-50 text-indigo-600 transition-all"
                          title="Unduh Template"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Unggah Template Absensi:</label>
                        <input
                          type="file"
                          accept=".xlsx,.xls"
                          onChange={(e) => handleSecondaryUpload(e, "absensi")}
                          className="w-full text-xs text-slate-500 bg-white border border-slate-200 rounded-lg p-1"
                        />
                      </div>
                    </div>

                    {/* Template 2 */}
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col gap-3">
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="text-xs font-bold text-slate-800">Template Catatan BK (Bimbingan)</h4>
                          <p className="text-[10px] text-slate-400">Rekap dossier kasus disiplin perilaku siswa</p>
                        </div>
                        <button
                          onClick={() => triggerDownloadTemplate("bk")}
                          className="p-2 bg-white rounded-lg border border-slate-200 hover:bg-slate-50 text-indigo-600 transition-all"
                          title="Unduh Template"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Unggah Template BK:</label>
                        <input
                          type="file"
                          accept=".xlsx,.xls"
                          onChange={(e) => handleSecondaryUpload(e, "bk")}
                          className="w-full text-xs text-slate-500 bg-white border border-slate-200 rounded-lg p-1"
                        />
                      </div>
                    </div>

                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ==============================================
              6. LEDGER CLASS DATABASE (TABLE GRID)
              ============================================== */}
          {activeTab === "database" && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
              
              {/* Table Controls */}
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
                  <div className="relative flex-1 md:w-64">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="Cari nama, NISN, NIS..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all"
                    />
                  </div>
                  
                  <div className="flex gap-1.5">
                    {[
                      { id: "ALL", label: "Semua" },
                      { id: "HIGH", label: "High Achiever" },
                      { id: "STABIL", label: "Stabil" },
                      { id: "FOKUS", label: "Fokus Perbaikan" }
                    ].map(btn => (
                      <button
                        key={btn.id}
                        onClick={() => setBadgeFilter(btn.id)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all duration-200 ${
                          badgeFilter === btn.id
                            ? "bg-slate-800 text-white"
                            : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"
                        }`}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 text-xs bg-white border border-slate-200 hover:border-indigo-500 hover:text-indigo-600 text-slate-700 rounded-xl font-semibold shadow-xs hover:bg-slate-50 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-4 h-4 text-slate-500" />
                    Unggah Leger Baru (.xlsx)
                  </button>
                  <button
                    onClick={handleExportExcel}
                    className="px-4 py-2 text-xs bg-indigo-600 text-white rounded-xl font-semibold shadow-xs hover:bg-indigo-700 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    Ekspor Excel Database
                  </button>
                </div>
              </div>

              {/* Data Table */}
              <div className="flex-1 overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-slate-50/30">
                      <th className="px-6 py-4">No & Nama</th>
                      <th className="px-6 py-4">NISN / NIS</th>
                      <th className="px-6 py-4 text-center">Rerata Nilai</th>
                      <th className="px-6 py-4 text-center">Total Nilai</th>
                      <th className="px-6 py-4 text-center">Kecepatan Belajar</th>
                      <th className="px-6 py-4 text-right">Status Profil</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs divide-y divide-slate-100">
                    {filteredStudents.length > 0 ? (
                      filteredStudents.map((student, index) => (
                        <tr 
                          key={student.Nama} 
                          onClick={() => {
                            setSelectedStudentName(student.Nama);
                            setActiveTab("profile");
                          }}
                          className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-slate-400 text-[10px]">
                                {(student.id).toString().padStart(2, "0")}
                              </span>
                              <div>
                                <div className="font-bold text-slate-800">{student.Nama}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-mono text-[10px] text-slate-600 font-semibold">{student.NISN}</div>
                            <div className="font-mono text-[10px] text-slate-400">NIS: {student.NIS}</div>
                          </td>
                          <td className="px-6 py-4 text-center font-extrabold text-slate-800">
                            {student["Rata-rata"]}
                          </td>
                          <td className="px-6 py-4 text-center font-bold text-slate-700">
                            {student["Total Nilai"]}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`font-bold inline-flex items-center gap-0.5 ${
                              student.Tren_Belajar >= 0 ? "text-emerald-600" : "text-rose-600"
                            }`}>
                              {student.Tren_Belajar >= 0 ? "+" : ""}{student.Tren_Belajar} Poin
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase border ${
                              student.Badge.includes("High") 
                                ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
                                : student.Badge.includes("Stabil") 
                                ? "bg-indigo-50 text-indigo-700 border-indigo-100"
                                : "bg-rose-50 text-rose-700 border-rose-100"
                            }`}>
                              {student.Badge.split(" ").slice(1).join(" ")}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center font-semibold text-slate-400">
                          Siswa tidak ditemukan. Cari dengan kata kunci lain.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

      </main>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="h-16 bg-white border-t border-slate-200 fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around md:hidden no-print shadow-lg">
        {[
          { id: "profile", label: "Profil", icon: <User className="w-5 h-5" /> },
          { id: "compare", label: "Bandingan", icon: <ArrowRightLeft className="w-5 h-5" /> },
          { id: "cluster", label: "AI Klaster", icon: <Sparkles className="w-5 h-5" /> },
          { id: "database", label: "Database", icon: <Database className="w-5 h-5" /> }
        ].map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center gap-1 transition-all ${
              activeTab === item.id ? "text-indigo-600 font-bold" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            {item.icon}
            <span className="text-[9px] font-bold uppercase tracking-wider">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* --- OFFLINE / STANDALONE PRINT VERSION OVERLAY FOR WINDOW.PRINT() --- */}
      <div className="hidden print:block p-8 bg-white font-sans text-black select-text">
        <div className="border-b-2 border-black pb-4 mb-6">
          <h1 className="text-2xl font-black text-center tracking-tight uppercase">LAPORAN PROFILING SISWA DIGITAL</h1>
          <p className="text-center font-mono text-xs uppercase mt-1">SMP NEGERI 1 WANAYASA • {kelasName} • {loadedFileName}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 text-xs mb-6">
          <div>
            <p><b>Nama Siswa:</b> {activeStudent?.Nama}</p>
            <p><b>NISN / NIS:</b> {activeStudent?.NISN} / {activeStudent?.NIS}</p>
            <p><b>Peringkat Kelas:</b> #{students.findIndex(s => s.Nama === activeStudent?.Nama) + 1} dari {students.length}</p>
          </div>
          <div className="text-right">
            <p><b>Nilai Rata-rata:</b> {activeStudent?.["Rata-rata"]}</p>
            <p><b>Total Nilai:</b> {activeStudent?.["Total Nilai"]}</p>
            <p><b>Kecepatan Belajar:</b> {activeStudent?.Tren_Belajar >= 0 ? "+" : ""}{activeStudent?.Tren_Belajar} Poin</p>
          </div>
        </div>

        <div className="border-t border-slate-300 pt-4 mb-6">
          <h2 className="text-sm font-bold uppercase mb-2">A. DAFTAR CAPAIAN NILAI MATA PELAJARAN</h2>
          <table className="w-full text-left border text-xs">
            <thead>
              <tr className="border bg-slate-100">
                <th className="p-2">Mata Pelajaran</th>
                <th className="p-2 text-center">Nilai Rata-rata</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map(sub => (
                <tr key={sub} className="border">
                  <td className="p-2 font-medium">{SUBJECTS_MAP[sub as keyof typeof SUBJECTS_MAP] || sub}</td>
                  <td className="p-2 text-center font-bold">{activeStudent?.[sub] || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t border-slate-300 pt-4 mb-4">
          <h2 className="text-sm font-bold uppercase mb-2">B. REKOMENDASI DAN REMARK WALI KELAS (AI PROFILING)</h2>
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-slate-100 rounded-lg">
              <p className="font-bold mb-1">📋 Catatan Wali Kelas:</p>
              <p className="italic">{aiProfileResult?.remarks || "Pertahankan prestasi belajarmu yang luar biasa!"}</p>
            </div>
            <div className="p-3 bg-slate-100 rounded-lg">
              <p className="font-bold mb-1">🎯 Rekomendasi Remedial & Belajar Mandiri:</p>
              <p>{aiProfileResult?.remedialTips || "Giatlah belajar secara teratur di rumah."}</p>
            </div>
            <div className="p-3 bg-slate-100 rounded-lg">
              <p className="font-bold mb-1">🛤️ Trajektori & Proyeksi Penjurusan Karir:</p>
              <p>{aiProfileResult?.careerAdvice || "Direkomendasikan memilih penjurusan SMA/SMK sesuai bidang yang dikuasai."}</p>
            </div>
          </div>
        </div>

        <div className="mt-12 flex justify-between text-xs pt-8 border-t border-dashed">
          <div>
            <p>Siswa Bersangkutan,</p>
            <br /><br /><br />
            <p className="font-bold">_________________________</p>
          </div>
          <div className="text-right">
            <p>Wanayasa, {new Date().toLocaleDateString("id-ID")}</p>
            <p>Wali Kelas {kelasName},</p>
            <br /><br /><br />
            <p className="font-bold">_________________________</p>
          </div>
        </div>
      </div>

    </div>
  );
}
