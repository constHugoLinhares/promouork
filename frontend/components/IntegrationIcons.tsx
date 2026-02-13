'use client';

import Image, { type StaticImageData } from 'next/image';
import whatsappIcon from './icons/whatsapp icon.png';
import shopeeIcon from './icons/shopee icon.png';
import aliexpressIcon from './icons/aliexpress icon.png';

const iconSize = 48;

const iconSrcMap: Record<string, StaticImageData> = {
  evolution: whatsappIcon,
  aliexpress: aliexpressIcon,
  shopee: shopeeIcon,
};

export function IntegrationIcon({
  type,
  className = '',
}: {
  type: string;
  className?: string;
}) {
  const img = iconSrcMap[type];

  if (!img) {
    return (
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-dark-border text-dark-muted text-lg font-semibold ${className}`}
      >
        ?
      </div>
    );
  }

  return (
    <div
      className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 overflow-hidden bg-white/5 ${className}`}
    >
      <Image
        src={img}
        alt=""
        width={iconSize}
        height={iconSize}
        className="w-full h-full object-contain"
        aria-hidden
      />
    </div>
  );
}
