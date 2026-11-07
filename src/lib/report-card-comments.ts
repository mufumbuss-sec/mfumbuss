export type CommentBandKey =
  | "top"
  | "very_good"
  | "satisfactory"
  | "needs_improvement"
  | "low_average"
  | "very_low";

export type CommentRole = "headmaster" | "subjectTeacher" | "classTeacher";

export type CommentBand = {
  key: CommentBandKey;
  min: number;
  label: string;
  comments: Record<CommentRole, string[]>;
};

/**
 * Edit this list to change the automatic report-card comments.
 * Bands are checked from top to bottom, so keep them ordered highest first.
 */
export const COMMENT_BANDS: CommentBand[] = [
  {
    key: "top",
    min: 85,
    label: "Bora",
    comments: {
      headmaster: [
        "Hongera sana kwa matokeo bora. Endelea kufanya kazi kwa bidii na kuwa mfano kwa wenzako.",
        "Matokeo haya ni ya kiwango cha juu. Endelea kudumisha juhudi na nidhamu katika masomo yote.",
      ],
      subjectTeacher: [
        "Umefanya vizuri sana katika masomo yote. Endelea kufanya mazoezi ya ziada na kushiriki kwenye majadiliano.",
        "Uelewa wako ni wa hali ya juu. Endelea kuchambua maswali kwa kina ili kudumisha kiwango hiki.",
      ],
      classTeacher: [
        "Mwanafunzi mwenye nidhamu na bidii. Endelea kuwa mfano mzuri kwa wenzako.",
        "Tabia na ushiriki wako darasani ni bora. Endelea kushirikiana na walimu na wanafunzi wenzako.",
      ],
    },
  },
  {
    key: "very_good",
    min: 75,
    label: "Nzuri Sana",
    comments: {
      headmaster: [
        "Matokeo ni mazuri sana. Endelea kujituma ili kufikia kiwango cha juu zaidi.",
        "Hongera kwa kazi nzuri. Ongeza jitihada kidogo ili kufikia matokeo bora zaidi.",
      ],
      subjectTeacher: [
        "Umeonyesha uelewa mzuri. Jitahidi zaidi kwenye maswali ya uchambuzi ili kupata alama za juu.",
        "Matokeo yako ni ya kuridhisha sana. Endelea kufanya marudio ya mara kwa mara.",
      ],
      classTeacher: [
        "Nidhamu na juhudi zako ni nzuri. Endelea kushiriki vizuri katika shughuli za darasa.",
        "Una tabia nzuri na ushirikiano mzuri. Endelea kudumisha mwenendo huu.",
      ],
    },
  },
  {
    key: "satisfactory",
    min: 65,
    label: "Nzuri",
    comments: {
      headmaster: [
        "Matokeo ni ya kuridhisha. Ongeza bidii katika masomo yenye changamoto ili kuboresha zaidi.",
        "Kazi nzuri. Weka malengo ya juu zaidi na ufuatilie maendeleo yako kila mtihani.",
      ],
      subjectTeacher: [
        "Uelewa ni wa kuridhisha. Rekebisha makosa na ufanye mazoezi ya kutosha kwa kila somo.",
        "Endelea kufanya kazi kwa bidii. Tumia muda wa ziada kufanya marudio ya masomo yenye ugumu.",
      ],
      classTeacher: [
        "Tabia ni nzuri. Ongeza ushiriki na ufuate ushauri wa walimu ili kuboresha zaidi.",
        "Mwenendo ni wa kuridhisha. Endelea kushiriki katika shughuli za darasa na kudumisha nidhamu.",
      ],
    },
  },
  {
    key: "needs_improvement",
    min: 45,
    label: "Inaridhisha",
    comments: {
      headmaster: [
        "Kuna nafasi ya kuboresha. Panga vyema muda wa kusoma na shirikiana na walimu.",
        "Matokeo yanaweza kuwa bora zaidi. Ongeza juhudi na ufuate mpango wa masomo kwa karibu.",
      ],
      subjectTeacher: [
        "Ongeza muda wa kujisomea na kufanya mazoezi. Tafuta mwongozo wa mwalimu kwenye masomo yenye ugumu.",
        "Hakikisha unakamilisha kazi zote za darasani na kufanya marudio ya mara kwa mara.",
      ],
      classTeacher: [
        "Jitahidi kuboresha nidhamu na ushiriki darasani. Panga muda wako vizuri.",
        "Ongeza mahudhurio na ushiriki wa darasa. Ushirikiano wa mzazi/mlezi utasaidia kuboresha matokeo.",
      ],
    },
  },
  {
    key: "low_average",
    min: 30,
    label: "Wastani wa Chini",
    comments: {
      headmaster: [
        "Matokeo yanahitaji jitihada za ziada. Tumia msaada wa walimu na wazazi kujenga msingi imara.",
        "Inashauriwa kuweka mpango wa ziada wa kusoma na ufuatiliaji wa karibu nyumbani na shuleni.",
      ],
      subjectTeacher: [
        "Hakikisha unakamilisha kazi zote za darasani na kufanya marudio ya mara kwa mara.",
        "Anza kwa kujenga msingi wa masomo kwa mazoezi ya hatua kwa hatua na usaidizi wa mwalimu.",
      ],
      classTeacher: [
        "Hudhuria vipindi vyote na shiriki kikamilifu. Ushirikiano wa mzazi/mlezi ni muhimu.",
        "Jitahidi kuboresha nidhamu, mahudhurio na utunzaji wa vifaa vya shule.",
      ],
    },
  },
  {
    key: "very_low",
    min: 0,
    label: "Unahitaji Kuboreshwa Sana",
    comments: {
      headmaster: [
        "Matokeo si ya kuridhisha. Inashauriwa kuweka mpango wa ziada wa kusoma na ufuatiliaji wa karibu.",
        "Hali hii inahitaji msaada wa pamoja kati ya shule na wazazi ili kuboresha matokeo.",
      ],
      subjectTeacher: [
        "Anza kwa kujenga msingi wa masomo kwa mazoezi ya hatua kwa hatua na usaidizi wa mwalimu.",
        "Hudhuria vipindi vya ziada na kamilisha kazi zote za darasani kwa usaidizi wa mwalimu.",
      ],
      classTeacher: [
        "Inahitaji ufuatiliaji wa karibu wa nidhamu na mahudhurio. Shirikiana na walimu na wazazi.",
        "Panga muda wa kusoma nyumbani na ufuate ushauri wa mwalimu wa darasa kwa karibu.",
      ],
    },
  },
];

export function commentBandForAverage(average: number | null | undefined): CommentBand {
  const value = average === null || average === undefined ? 0 : average;
  return COMMENT_BANDS.find((band) => value >= band.min) ?? COMMENT_BANDS[COMMENT_BANDS.length - 1];
}

function stableIndex(seed: string, length: number) {
  if (length <= 1) return 0;
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return hash % length;
}

export function commentForAverage(
  average: number | null | undefined,
  role: CommentRole,
  seed: string,
) {
  const band = commentBandForAverage(average);
  const choices = band.comments[role];
  return choices[stableIndex(`${band.key}:${role}:${seed}`, choices.length)] ?? "";
}
