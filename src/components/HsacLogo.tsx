import React from "react";

interface HsacLogoProps {
  className?: string;
  size?: number;
}

export default function HsacLogo({ className = "", size = 48 }: HsacLogoProps) {
  // SVG representation of the official HSAC 2019 emblem
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 400 400" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} select-none`}
    >
      <defs>
        {/* Top arc for "HUMAN SETTLEMENTS ADJUDICATION COMMISSION" */}
        <path
          id="textArcTop"
          d="M 52,200 A 148,148 0 1,1 348,200"
          fill="none"
        />
        {/* Bottom arc for "2019" */}
        <path
          id="textArcBottom"
          d="M 320,200 A 120,120 0 0,1 80,200"
          fill="none"
        />
        {/* Shield clipping path below the horizontal divider */}
        <clipPath id="shieldClip">
          <path d="M 88,208 A 112,112 0 0,0 312,208 Z" />
        </clipPath>
      </defs>

      {/* Exterior base circle background */}
      <circle cx="200" cy="200" r="195" fill="#FFFFFF" stroke="#001D85" strokeWidth="4" />
      
      {/* Outer border circular frame */}
      <circle cx="200" cy="200" r="154" fill="none" stroke="#001D85" strokeWidth="3" />

      {/* TEXT: HUMAN SETTLEMENTS ADJUDICATION COMMISSION */}
      <text fill="#001D85" className="font-sans font-extrabold text-[15.5px] tracking-[0.06em]">
        <textPath href="#textArcTop" startOffset="50%" textAnchor="middle">
          HUMAN SETTLEMENTS ADJUDICATION COMMISSION
        </textPath>
      </text>

      {/* TEXT: 2019 */}
      <text fill="#001D85" className="font-sans font-black text-[25px]" letterSpacing="6">
        <textPath href="#textArcBottom" startOffset="50%" textAnchor="middle">
          2019
        </textPath>
      </text>

      {/* Concentric spiral swooshes */}
      <path 
        d="M 200,46 A 154,154 0 1,0 354,200" 
        stroke="#001D85" 
        strokeWidth="3.5" 
        fill="none" 
      />
      <path 
        d="M 200,354 A 154,154 0 1,0 46,200" 
        stroke="#001D85" 
        strokeWidth="3.5" 
        fill="none" 
      />

      {/* Inner emblem ring */}
      <circle cx="200" cy="200" r="114" fill="#FFFFFF" stroke="#001D85" strokeWidth="3.5" />

      {/* Balance Scale of Justice (Pillar / Head / beam) */}
      <rect x="195" y="112" width="10" height="135" fill="#001D85" />
      <path d="M 172,250 L 228,250 L 210,238 L 190,238 Z" fill="#001D85" />
      
      {/* Central Support Cap */}
      <circle cx="200" cy="116" r="8.5" fill="#001D85" />
      <path d="M 188,131 L 212,131 L 200,121 Z" fill="#001D85" />

      {/* Main horizontal beam of scale */}
      <path d="M 120,154 Q 200,128 280,154" stroke="#001D85" strokeWidth="6.5" fill="none" strokeLinecap="round" />
      
      {/* Left scale pan & support wires */}
      <line x1="140" y1="154" x2="118" y2="191" stroke="#001D85" strokeWidth="2" />
      <line x1="140" y1="154" x2="162" y2="191" stroke="#001D85" strokeWidth="2" />
      <path d="M 112,191 L 168,191 A 28,28 0 0,1 112,191 Z" fill="#001D85" />

      {/* Right scale pan & support wires */}
      <line x1="260" y1="154" x2="238" y2="191" stroke="#001D85" strokeWidth="2" />
      <line x1="260" y1="154" x2="282" y2="191" stroke="#001D85" strokeWidth="2" />
      <path d="M 232,191 L 288,191 A 28,28 0 0,1 232,191 Z" fill="#001D85" />

      {/* Thick Divider Base Bar */}
      <rect x="86" y="201" width="228" height="15" fill="#001D85" />

      {/* Lower Shield Semi-circle with color bands (clipping applied) */}
      <g clipPath="url(#shieldClip)">
        {/* Left & Right inner blocks */}
        <path d="M 88,208 A 112,112 0 0,0 195,312 L 195,208 Z" fill="#FFFFFF" />
        <path d="M 205,208 L 205,312 A 112,112 0 0,0 312,208 Z" fill="#FFFFFF" />

        {/* Green Band (Forest/Agri top stripe) */}
        <rect x="85" y="215" width="230" height="17" fill="#1B8A3E" />
        {/* White Border */}
        <rect x="85" y="232" width="230" height="4.5" fill="#FFFFFF" />
        {/* Brown Band (Land/Soil middle stripe) */}
        <rect x="85" y="236.5" width="230" height="17" fill="#8B5A2B" />
        {/* White Border */}
        <rect x="85" y="253.5" width="230" height="4.5" fill="#FFFFFF" />
        {/* Cyan Band (Water/Marine bottom stripe) */}
        <rect x="85" y="258" width="230" height="26" fill="#33E1FF" />

        {/* Heavy framing borders inside local quadrants */}
        <path d="M 195,201 L 195,312" stroke="#001D85" strokeWidth="11" />
        <path d="M 205,201 L 205,312" stroke="#001D85" strokeWidth="11" strokeLinecap="square" />
        <path d="M 88,204 A 112,112 0 0,0 312,204" fill="none" stroke="#001D85" strokeWidth="11" />
      </g>
    </svg>
  );
}
