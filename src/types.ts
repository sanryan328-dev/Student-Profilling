export interface Student {
  id: number;
  Nama: string;
  NISN: string;
  NIS: string;
  Badge: string;
  "Total Nilai": number;
  "Rata-rata": number;
  "Tren_Belajar": number;
  "PAI"?: number;
  "PPKn"?: number;
  "B.IND"?: number;
  "B.ING"?: number;
  "B.SUN"?: number;
  "MTK"?: number;
  "IPA"?: number;
  "IPS"?: number;
  "PJOK"?: number;
  "SENI"?: number;
  "INF"?: number;
  [key: string]: any;
}

export interface StudentDetail extends Student {
  Ekskul_Pramuka?: string;
  Ekskul_Kesenian?: string;
  Ekskul_Olahraga?: string;
  Sakit?: number;
  Izin?: number;
  Alpa?: number;
  "Catatan BK"?: string;
  Skor_Disiplin?: number;
}

export interface SubjectStats {
  subject: string;
  average: number;
}

export interface ClusterGroup {
  name: string;
  students: { Nama: string; "Rata-rata": number }[];
}
