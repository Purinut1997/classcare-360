import React from "react";

export type MascotAvatarType = "bear" | "cat" | "bunny" | "girl" | "shiba";

export interface MascotOption {
  id: MascotAvatarType;
  name: string;
  emoji: string;
  description: string;
}

export const MASCOT_OPTIONS: MascotOption[] = [
  {
    id: "bear",
    name: "น้องหมีแคร์",
    emoji: "🐻",
    description: "หมีน้อยนุ่มฟู อบอุ่น ใจดี พร้อมดูแลคุณครูและเด็กๆ",
  },
  {
    id: "cat",
    name: "น้องแมวแคร์",
    emoji: "🐱",
    description: "แมวน้อยร่าเริง ช่างพูด คอยช่วยตอบทุกคำถาม",
  },
  {
    id: "bunny",
    name: "น้องกระต่ายแคร์",
    emoji: "🐰",
    description: "กระต่ายหูยาวแสนฉลาด ละเอียดรอบคอบ จัดการงานไว",
  },
  {
    id: "girl",
    name: "น้องแคร์ตัวจิ๋ว",
    emoji: "👧",
    description: "ผู้ช่วยสาวน้อยวัยใส แก้มชมพู ใส่ใจทุกงานเอกสาร",
  },
  {
    id: "shiba",
    name: "น้องหมาชิบะ",
    emoji: "🐶",
    description: "สุนัขชิบะหน้ากลม ยิ้มแฉ่ง ซื่อสัตย์ ขยันขันแข็ง",
  },
];

interface CuteCareyAvatarProps {
  type?: MascotAvatarType;
  size?: number | string;
  className?: string;
  animate?: boolean;
}

/**
 * High-definition, ultra-cute vector mascot for ClassCare 360 ("น้องแคร์")
 */
export function CuteCareyAvatar({
  type = "bear",
  size = 40,
  className = "",
  animate = true,
}: CuteCareyAvatarProps) {
  const dimension = typeof size === "number" ? `${size}px` : size;

  switch (type) {
    case "cat":
      return (
        <svg
          viewBox="0 0 100 100"
          style={{ width: dimension, height: dimension }}
          className={`shrink-0 select-none ${animate ? "transition-transform hover:scale-110" : ""} ${className}`}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <radialGradient id="catFaceGrad" cx="45%" cy="40%" r="55%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="70%" stopColor="#f8fafc" />
              <stop offset="100%" stopColor="#e2e8f0" />
            </radialGradient>
            <linearGradient id="catEarGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fb7185" />
              <stop offset="100%" stopColor="#fda4af" />
            </linearGradient>
            <radialGradient id="catBlush" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Left Ear */}
          <path
            d="M20 44 L26 12 Q33 10 44 26 Z"
            fill="#e2e8f0"
            stroke="#cbd5e1"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="M23 40 L28 17 Q34 16 41 28 Z" fill="url(#catEarGrad)" />

          {/* Right Ear */}
          <path
            d="M80 44 L74 12 Q67 10 56 26 Z"
            fill="#e2e8f0"
            stroke="#cbd5e1"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="M77 40 L72 17 Q66 16 59 28 Z" fill="url(#catEarGrad)" />

          {/* Cat Head */}
          <ellipse cx="50" cy="56" rx="38" ry="34" fill="url(#catFaceGrad)" />
          <path
            d="M12 56 C12 37 29 26 50 26 C71 26 88 37 88 56 C88 75 71 88 50 88 C29 88 12 75 12 56 Z"
            fill="url(#catFaceGrad)"
            stroke="#e2e8f0"
            strokeWidth="1.5"
          />

          {/* Cheeks Blush */}
          <circle cx="27" cy="63" r="8" fill="url(#catBlush)" />
          <circle cx="73" cy="63" r="8" fill="url(#catBlush)" />

          {/* Left Eye */}
          <ellipse cx="34" cy="52" rx="6.5" ry="7.5" fill="#0f172a" />
          <circle cx="32" cy="49" r="2.8" fill="#ffffff" />
          <circle cx="36.5" cy="55" r="1.3" fill="#ffffff" />

          {/* Right Eye */}
          <ellipse cx="66" cy="52" rx="6.5" ry="7.5" fill="#0f172a" />
          <circle cx="64" cy="49" r="2.8" fill="#ffffff" />
          <circle cx="68.5" cy="55" r="1.3" fill="#ffffff" />

          {/* Nose */}
          <polygon points="50,59 47.5,56 52.5,56" fill="#f43f5e" />

          {/* Mouth */}
          <path
            d="M45 61 Q48 64 50 61 Q52 64 55 61"
            stroke="#334155"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
          />

          {/* Whiskers */}
          <path
            d="M18 57 L29 59 M17 64 L29 63"
            stroke="#94a3b8"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M82 57 L71 59 M83 64 L71 63"
            stroke="#94a3b8"
            strokeWidth="1.8"
            strokeLinecap="round"
          />

          {/* Little Star Hairclip */}
          <path
            d="M68 28 L70 33 L75 34 L71 37 L72 42 L68 39 L64 42 L65 37 L61 34 L66 33 Z"
            fill="#facc15"
            stroke="#eab308"
            strokeWidth="0.8"
          />
        </svg>
      );

    case "bunny":
      return (
        <svg
          viewBox="0 0 100 100"
          style={{ width: dimension, height: dimension }}
          className={`shrink-0 select-none ${animate ? "transition-transform hover:scale-110" : ""} ${className}`}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <radialGradient id="bunnyFaceGrad" cx="50%" cy="45%" r="55%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="85%" stopColor="#fff1f2" />
              <stop offset="100%" stopColor="#ffe4e6" />
            </radialGradient>
            <linearGradient id="bunnyEarInner" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f472b6" />
              <stop offset="100%" stopColor="#fbcfe8" />
            </linearGradient>
            <radialGradient id="bunnyBlush" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fb7185" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#fb7185" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Left Bunny Ear */}
          <ellipse
            cx="33"
            cy="26"
            rx="9"
            ry="24"
            transform="rotate(-12 33 26)"
            fill="#ffffff"
            stroke="#fecdd3"
            strokeWidth="1.8"
          />
          <ellipse
            cx="33"
            cy="26"
            rx="4.5"
            ry="18"
            transform="rotate(-12 33 26)"
            fill="url(#bunnyEarInner)"
          />

          {/* Right Bunny Ear (cute slightly tilted) */}
          <ellipse
            cx="67"
            cy="26"
            rx="9"
            ry="24"
            transform="rotate(14 67 26)"
            fill="#ffffff"
            stroke="#fecdd3"
            strokeWidth="1.8"
          />
          <ellipse
            cx="67"
            cy="26"
            rx="4.5"
            ry="18"
            transform="rotate(14 67 26)"
            fill="url(#bunnyEarInner)"
          />

          {/* Bunny Head */}
          <circle cx="50" cy="62" r="33" fill="url(#bunnyFaceGrad)" stroke="#fecdd3" strokeWidth="1.5" />

          {/* Blush */}
          <circle cx="26" cy="68" r="8" fill="url(#bunnyBlush)" />
          <circle cx="74" cy="68" r="8" fill="url(#bunnyBlush)" />

          {/* Left Eye */}
          <ellipse cx="36" cy="58" rx="6" ry="7" fill="#4a044e" />
          <circle cx="34" cy="55" r="2.6" fill="#ffffff" />
          <circle cx="38" cy="60" r="1.2" fill="#ffffff" />

          {/* Right Eye */}
          <ellipse cx="64" cy="58" rx="6" ry="7" fill="#4a044e" />
          <circle cx="62" cy="55" r="2.6" fill="#ffffff" />
          <circle cx="66" cy="60" r="1.2" fill="#ffffff" />

          {/* Little Cute Heart Nose */}
          <path
            d="M50 67 C49 65 46 65 46 67 C46 69 50 71 50 71 C50 71 54 69 54 67 C54 65 51 65 50 67 Z"
            fill="#f43f5e"
          />

          {/* Mouth */}
          <path
            d="M46 72 Q48 74.5 50 72 Q52 74.5 54 72"
            stroke="#701a75"
            strokeWidth="1.8"
            fill="none"
            strokeLinecap="round"
          />

          {/* Ribbon on Left Ear Base */}
          <circle cx="39" cy="42" r="3.5" fill="#f43f5e" />
          <polygon points="39,42 30,37 32,45" fill="#fb7185" />
          <polygon points="39,42 45,35 46,43" fill="#fb7185" />
        </svg>
      );

    case "girl":
      return (
        <svg
          viewBox="0 0 100 100"
          style={{ width: dimension, height: dimension }}
          className={`shrink-0 select-none ${animate ? "transition-transform hover:scale-110" : ""} ${className}`}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <radialGradient id="girlFaceGrad" cx="50%" cy="45%" r="50%">
              <stop offset="0%" stopColor="#fff5eb" />
              <stop offset="90%" stopColor="#fed7aa" />
              <stop offset="100%" stopColor="#fdba74" />
            </radialGradient>
            <radialGradient id="girlBlush" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="hairGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#475569" />
              <stop offset="100%" stopColor="#1e293b" />
            </linearGradient>
          </defs>

          {/* Hair Pigtails (Twin Buns / Ponytails) */}
          <circle cx="16" cy="38" r="14" fill="url(#hairGrad)" />
          <circle cx="84" cy="38" r="14" fill="url(#hairGrad)" />

          {/* Ribbons */}
          <ellipse cx="23" cy="44" rx="4" ry="5.5" fill="#ec4899" />
          <ellipse cx="77" cy="44" rx="4" ry="5.5" fill="#ec4899" />

          {/* Face */}
          <circle cx="50" cy="55" r="31" fill="url(#girlFaceGrad)" />

          {/* Hair Front Bangs */}
          <path
            d="M20 50 C20 28 32 18 50 18 C68 18 80 28 80 50 C76 43 70 38 62 38 C56 44 48 38 42 38 C34 38 26 44 20 50 Z"
            fill="url(#hairGrad)"
          />

          {/* Cheeks Blush */}
          <circle cx="28" cy="65" r="7.5" fill="url(#girlBlush)" />
          <circle cx="72" cy="65" r="7.5" fill="url(#girlBlush)" />

          {/* Left Eye */}
          <ellipse cx="36" cy="56" rx="6.5" ry="8" fill="#0f172a" />
          <ellipse cx="36" cy="58" rx="4.5" ry="5.5" fill="#3b82f6" />
          <circle cx="34" cy="53" r="2.8" fill="#ffffff" />
          <circle cx="38.5" cy="59" r="1.3" fill="#ffffff" />
          {/* Eyelash */}
          <path d="M30 50 Q36 47 43 51" stroke="#0f172a" strokeWidth="2.2" strokeLinecap="round" fill="none" />

          {/* Right Eye */}
          <ellipse cx="64" cy="56" rx="6.5" ry="8" fill="#0f172a" />
          <ellipse cx="64" cy="58" rx="4.5" ry="5.5" fill="#3b82f6" />
          <circle cx="62" cy="53" r="2.8" fill="#ffffff" />
          <circle cx="66.5" cy="59" r="1.3" fill="#ffffff" />
          {/* Eyelash */}
          <path d="M57 51 Q64 47 70 50" stroke="#0f172a" strokeWidth="2.2" strokeLinecap="round" fill="none" />

          {/* Smile */}
          <path
            d="M44 68 Q50 74 56 68"
            stroke="#be185d"
            strokeWidth="2.2"
            fill="#f43f5e"
            strokeLinecap="round"
          />

          {/* Cute Yellow Hair Star Clip */}
          <path
            d="M28 32 L30 36 L34 37 L31 40 L32 44 L28 41 L24 44 L25 40 L22 37 L26 36 Z"
            fill="#fde047"
            stroke="#eab308"
            strokeWidth="0.8"
          />
        </svg>
      );

    case "shiba":
      return (
        <svg
          viewBox="0 0 100 100"
          style={{ width: dimension, height: dimension }}
          className={`shrink-0 select-none ${animate ? "transition-transform hover:scale-110" : ""} ${className}`}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <radialGradient id="shibaFurGrad" cx="50%" cy="40%" r="55%">
              <stop offset="0%" stopColor="#f59e0b" />
              <stop offset="75%" stopColor="#d97706" />
              <stop offset="100%" stopColor="#b45309" />
            </radialGradient>
            <radialGradient id="shibaBlush" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Left Ear */}
          <polygon points="17,39 28,12 43,28" fill="#d97706" stroke="#b45309" strokeWidth="1.5" strokeLinejoin="round" />
          <polygon points="21,36 29,18 39,28" fill="#fffbeb" />

          {/* Right Ear */}
          <polygon points="83,39 72,12 57,28" fill="#d97706" stroke="#b45309" strokeWidth="1.5" strokeLinejoin="round" />
          <polygon points="79,36 71,18 61,28" fill="#fffbeb" />

          {/* Shiba Face (Base Fur) */}
          <circle cx="50" cy="56" r="35" fill="url(#shibaFurGrad)" stroke="#b45309" strokeWidth="1.5" />

          {/* White Muzzle & Cheeks (Shiba signature white masks) */}
          <path
            d="M20 58 C20 48 30 46 36 50 C44 54 46 58 50 58 C54 58 56 54 64 50 C70 46 80 48 80 58 C80 75 67 87 50 87 C33 87 20 75 20 58 Z"
            fill="#fffbeb"
          />

          {/* White Eyebrow Dots */}
          <circle cx="35" cy="40" r="4.2" fill="#fffbeb" />
          <circle cx="65" cy="40" r="4.2" fill="#fffbeb" />

          {/* Left Eye (Joyful Happy Arc) */}
          <ellipse cx="36" cy="52" rx="5.5" ry="6.5" fill="#1c1917" />
          <circle cx="34" cy="49" r="2.2" fill="#ffffff" />
          <circle cx="38" cy="54" r="1" fill="#ffffff" />

          {/* Right Eye */}
          <ellipse cx="64" cy="52" rx="5.5" ry="6.5" fill="#1c1917" />
          <circle cx="62" cy="49" r="2.2" fill="#ffffff" />
          <circle cx="66" cy="54" r="1" fill="#ffffff" />

          {/* Blush */}
          <circle cx="24" cy="62" r="7" fill="url(#shibaBlush)" />
          <circle cx="76" cy="62" r="7" fill="url(#shibaBlush)" />

          {/* Nose */}
          <ellipse cx="50" cy="62" rx="5" ry="4" fill="#1c1917" />

          {/* Cute Open Mouth with Tongue */}
          <path
            d="M44 68 Q50 71 56 68"
            stroke="#1c1917"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M47 69 C47 75 53 75 53 69 Z"
            fill="#f43f5e"
            stroke="#be185d"
            strokeWidth="1"
          />
        </svg>
      );

    case "bear":
    default:
      // Teddy Bear Cub ("น้องหมีแคร์") - Warm, fluffy, irresistibly cute
      return (
        <svg
          viewBox="0 0 100 100"
          style={{ width: dimension, height: dimension }}
          className={`shrink-0 select-none ${animate ? "transition-transform hover:scale-110" : ""} ${className}`}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <radialGradient id="bearFurGrad" cx="45%" cy="38%" r="60%">
              <stop offset="0%" stopColor="#fed7aa" />
              <stop offset="65%" stopColor="#fdba74" />
              <stop offset="100%" stopColor="#f97316" />
            </radialGradient>
            <radialGradient id="bearMuzzleGrad" cx="50%" cy="40%" r="55%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#fff7ed" />
            </radialGradient>
            <radialGradient id="bearInnerEar" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fb7185" />
              <stop offset="100%" stopColor="#f43f5e" />
            </radialGradient>
            <radialGradient id="bearBlush" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="starGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="100%" stopColor="#eab308" />
            </linearGradient>
          </defs>

          {/* Left Round Ear */}
          <circle cx="23" cy="26" r="14" fill="url(#bearFurGrad)" stroke="#f97316" strokeWidth="1.5" />
          <circle cx="23" cy="26" r="8" fill="url(#bearInnerEar)" opacity="0.8" />

          {/* Right Round Ear */}
          <circle cx="77" cy="26" r="14" fill="url(#bearFurGrad)" stroke="#f97316" strokeWidth="1.5" />
          <circle cx="77" cy="26" r="8" fill="url(#bearInnerEar)" opacity="0.8" />

          {/* Fluffy Head */}
          <circle cx="50" cy="56" r="35" fill="url(#bearFurGrad)" stroke="#f97316" strokeWidth="1.5" />

          {/* Big Rosy Cheeks */}
          <circle cx="25" cy="64" r="8.5" fill="url(#bearBlush)" />
          <circle cx="75" cy="64" r="8.5" fill="url(#bearBlush)" />

          {/* Left Sparkling Anime Eye */}
          <ellipse cx="35" cy="50" rx="6.5" ry="7.5" fill="#1e1b4b" />
          <circle cx="33" cy="47" r="2.8" fill="#ffffff" />
          <circle cx="37.5" cy="53" r="1.3" fill="#ffffff" />

          {/* Right Sparkling Anime Eye */}
          <ellipse cx="65" cy="50" rx="6.5" ry="7.5" fill="#1e1b4b" />
          <circle cx="63" cy="47" r="2.8" fill="#ffffff" />
          <circle cx="67.5" cy="53" r="1.3" fill="#ffffff" />

          {/* Soft Cream Muzzle */}
          <ellipse cx="50" cy="66" rx="16" ry="13" fill="url(#bearMuzzleGrad)" stroke="#ffedd5" strokeWidth="1.2" />

          {/* Heart/Oval Button Nose */}
          <path
            d="M50 60 C48 58 45 58 45 60.5 C45 63 50 65 50 65 C50 65 55 63 55 60.5 C55 58 52 58 50 60 Z"
            fill="#78350f"
          />

          {/* Sweet Bear Smile */}
          <path
            d="M45 66 Q48 69.5 50 66 Q52 69.5 55 66"
            stroke="#78350f"
            strokeWidth="2.2"
            fill="none"
            strokeLinecap="round"
          />

          {/* Cute Floating Star / Care Sparkle above left ear */}
          <path
            d="M20 12 L22 16 L26 17 L23 20 L24 24 L20 21 L16 24 L17 20 L14 17 L18 16 Z"
            fill="url(#starGrad)"
            stroke="#ca8a04"
            strokeWidth="0.8"
            className="animate-pulse"
          />
        </svg>
      );
  }
}
