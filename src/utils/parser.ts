import * as XLSX from "xlsx";
import { StudentDetail } from "../types";

export function cleanNISN(val: any): string {
  if (val === undefined || val === null) return "";
  const str = String(val).replace(/\.0$/, "").trim();
  return str ? str.padStart(10, "0") : "";
}

export function cleanNIS(val: any): string {
  if (val === undefined || val === null) return "";
  return String(val).replace(/\.0$/, "").trim();
}

export function parseLegerExcel(arrayBuffer: ArrayBuffer): {
  students: StudentDetail[];
  subjects: string[];
  kelasName: string;
} {
  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  
  // Parse worksheet into a 2D array of strings
  const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
  
  let kelasName = "Kelas Umum";
  // Find Kelas Name in first 15 rows
  for (let i = 0; i < Math.min(15, rawData.length); i++) {
    const rowStr = rawData[i].map(c => String(c).toUpperCase()).join(" ");
    if (rowStr.includes("KELAS") && rowStr.includes(":")) {
      const parts = rowStr.split(":");
      if (parts[1]) {
        kelasName = parts[1].replace("NAN", "").replace(/,/g, "").trim();
        break;
      }
    }
  }

  // Find Header Row where "NAMA" exists
  let headerIdx = 0;
  for (let i = 0; i < Math.min(30, rawData.length); i++) {
    const rowStr = rawData[i].map(c => String(c).toUpperCase());
    if (rowStr.some(cell => cell.includes("NAMA"))) {
      headerIdx = i;
      break;
    }
  }

  // Find Semester Row (containing smt1 or smt 1, etc.)
  let smtRowIdx = -1;
  for (let i = headerIdx; i < Math.min(headerIdx + 15, rawData.length); i++) {
    const rowStr = rawData[i].map(c => String(c).toLowerCase());
    if (rowStr.some(cell => cell.includes("smt1") || cell.includes("smt 1") || cell.includes("semester 1"))) {
      smtRowIdx = i;
      break;
    }
  }

  if (smtRowIdx === -1) {
    smtRowIdx = headerIdx; // fallback
  }

  // Find Columns for Nama, NIS, NISN
  const headerRow = rawData[headerIdx].map(c => String(c).toUpperCase().trim());
  let colNama = 1;
  let colNisn = 2;
  let colNis = 3;

  for (let idx = 0; idx < headerRow.length; idx++) {
    const val = headerRow[idx];
    if (val.includes("NAMA")) {
      colNama = idx;
    } else if (val.includes("NISN")) {
      colNisn = idx;
    } else if (val.includes("NIS") && !val.includes("NISN")) {
      colNis = idx;
    }
  }

  // Extract Subject Headers dynamically
  // Trace backwards from smtRowIdx to find subject names
  let subjectRowIdx = smtRowIdx - 1;
  while (subjectRowIdx > headerIdx) {
    const sample = rawData[subjectRowIdx].slice(colNis + 1, colNis + 12).map(c => String(c).trim());
    if (sample.some(c => c && c !== "nan" && c !== "none" && c !== "unnamed")) {
      break;
    }
    subjectRowIdx--;
  }

  if (subjectRowIdx <= headerIdx) {
    subjectRowIdx = headerIdx;
  }

  const rawSubjects = rawData[subjectRowIdx].map(c => String(c).trim());
  const smtLabels = rawData[smtRowIdx].map(c => String(c).toLowerCase().trim());

  // We map columns to normalized subjects
  // subjectMap structure: { shortName: { semesters: number[], rerataCol?: number, smt1?: number, smt3?: number } }
  const subjectCols: { [key: string]: { semesters: number[]; rerata?: number; smt1?: number; smt3?: number } } = {};
  let currentSubj: string | null = null;
  const mapelList: string[] = [];

  for (let c = colNis + 1; c < rawData[0].length; c++) {
    const subVal = String(rawSubjects[c] || "").trim();
    if (subVal && subVal.toLowerCase() !== "nan" && subVal !== "") {
      const lowerVal = subVal.toLowerCase();
      // Normalize Indonesian subject names verbatim or heuristically
      if (lowerVal.includes("agama") || lowerVal.includes("pai") || lowerVal.includes("budi pekerti")) {
        currentSubj = "PAI";
      } else if (lowerVal.includes("pancasila") || lowerVal.includes("ppkn") || lowerVal.includes("kewarganegaraan")) {
        currentSubj = "PPKn";
      } else if (lowerVal.includes("bahasa indonesia")) {
        currentSubj = "B.IND";
      } else if (lowerVal.includes("bahasa inggris")) {
        currentSubj = "B.ING";
      } else if (lowerVal.includes("sunda") || lowerVal.includes("daerah")) {
        currentSubj = "B.SUN";
      } else if (lowerVal.includes("matematika") || lowerVal.includes("mtk")) {
        currentSubj = "MTK";
      } else if (lowerVal.includes("alam") || lowerVal.includes("ipa")) {
        currentSubj = "IPA";
      } else if (lowerVal.includes("sosial") || lowerVal.includes("ips")) {
        currentSubj = "IPS";
      } else if (lowerVal.includes("jasmani") || lowerVal.includes("olahraga") || lowerVal.includes("pjok") || lowerVal.includes("kesehatan")) {
        currentSubj = "PJOK";
      } else if (lowerVal.includes("seni") || lowerVal.includes("budaya") || lowerVal.includes("prakarya")) {
        currentSubj = "SENI";
      } else if (lowerVal.includes("informatika") || lowerVal.includes("komputer") || lowerVal.includes("inf")) {
        currentSubj = "INF";
      } else if (lowerVal.includes("project") || lowerVal.includes("p5") || lowerVal.includes("profil")) {
        currentSubj = null; // Exclude P5
      } else {
        // dynamic truncation/shortening for fallback
        currentSubj = subVal.substring(0, 12).toUpperCase();
      }

      if (currentSubj && !subjectCols[currentSubj]) {
        subjectCols[currentSubj] = { semesters: [] };
        mapelList.push(currentSubj);
      }
    }

    if (currentSubj && subjectCols[currentSubj]) {
      const lbl = String(smtLabels[c] || "").toLowerCase();
      if (lbl.includes("smt") || lbl.includes("sem") || lbl.includes("semester")) {
        subjectCols[currentSubj].semesters.push(c);
        if (lbl.includes("1")) subjectCols[currentSubj].smt1 = c;
        if (lbl.includes("3")) subjectCols[currentSubj].smt3 = c;
      } else if (lbl.includes("rerata") || lbl.includes("rata")) {
        subjectCols[currentSubj].rerata = c;
      }
    }
  }

  // Parse Student Rows
  const dataStart = smtRowIdx + 1;
  const students: StudentDetail[] = [];
  let studentCounter = 1;

  for (let r = dataStart; r < rawData.length; r++) {
    const row = rawData[r];
    const rawName = String(row[colNama] || "").trim();
    if (!rawName || rawName.toUpperCase().match(/^(NAMA SISWA|TOTAL|AVERAGE|RELA|NAN|AVERAGE|KATA KUNCI|KETERANGAN|CATATAN)/)) {
      continue;
    }

    const student: StudentDetail = {
      id: studentCounter++,
      Nama: rawName,
      NISN: cleanNISN(row[colNisn]),
      NIS: cleanNIS(row[colNis]),
      Badge: "✅ Stabil",
      "Total Nilai": 0,
      "Rata-rata": 0,
      "Tren_Belajar": 0,
      Sakit: 0,
      Izin: 0,
      Alpa: 0,
      "Catatan BK": "-",
      Skor_Disiplin: 100
    };

    let totalSum = 0;
    let validSubjectCount = 0;
    const trenValuesSmt1: number[] = [];
    const trenValuesSmt3: number[] = [];

    mapelList.forEach(m => {
      const info = subjectCols[m];
      let score = 0;

      if (info.rerata !== undefined && row[info.rerata] !== "" && row[info.rerata] !== undefined) {
        score = parseFloat(row[info.rerata]) || 0;
      } else if (info.semesters.length > 0) {
        let sum = 0;
        let count = 0;
        info.semesters.forEach(cIdx => {
          const v = parseFloat(row[cIdx]);
          if (!isNaN(v)) {
            sum += v;
            count++;
          }
        });
        score = count > 0 ? parseFloat((sum / count).toFixed(2)) : 0;
      }

      if (score > 0) {
        student[m] = score;
        totalSum += score;
        validSubjectCount++;
      }

      // Track Smt1 and Smt3 values for Tren calculation
      if (info.smt1 !== undefined && info.smt3 !== undefined) {
        const s1 = parseFloat(row[info.smt1]);
        const s3 = parseFloat(row[info.smt3]);
        if (!isNaN(s1) && !isNaN(s3)) {
          trenValuesSmt1.push(s1);
          trenValuesSmt3.push(s3);
        }
      }
    });

    student["Total Nilai"] = parseFloat(totalSum.toFixed(2));
    student["Rata-rata"] = validSubjectCount > 0 ? parseFloat((totalSum / validSubjectCount).toFixed(2)) : 0;

    // Tren calculation (Smt3 - Smt1 average diff)
    if (trenValuesSmt1.length > 0 && trenValuesSmt3.length > 0) {
      const avgS1 = trenValuesSmt1.reduce((a, b) => a + b, 0) / trenValuesSmt1.length;
      const avgS3 = trenValuesSmt3.reduce((a, b) => a + b, 0) / trenValuesSmt3.length;
      student["Tren_Belajar"] = parseFloat((avgS3 - avgS1).toFixed(2));
    } else {
      student["Tren_Belajar"] = 0;
    }

    // Assign badge
    if (student["Rata-rata"] >= 85) {
      student.Badge = "🌟 High Achiever";
    } else if (student["Rata-rata"] < 75) {
      student.Badge = "🆘 Fokus Perbaikan";
    } else {
      student.Badge = "✅ Stabil";
    }

    students.push(student);
  }

  // Sort students by total score descending
  students.sort((a, b) => b["Total Nilai"] - a["Total Nilai"]);
  // Re-assign ids as sequence ranking
  students.forEach((s, idx) => {
    s.id = idx + 1;
  });

  return {
    students,
    subjects: mapelList,
    kelasName
  };
}
