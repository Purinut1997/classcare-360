interface AppLogoProps {
  className?: string;
  imageClassName?: string;
  variant?: 'icon' | 'wordmark';
}

const logoSources = {
  icon: '/brand/classcare-360-icon-512.png',
  wordmark: '/brand/classcare-360-wordmark.png',
};

export function AppLogo({ className = '', imageClassName = '', variant = 'icon' }: AppLogoProps) {
  return (
    <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden ${className}`}>
      <img
        alt="ClassCare 360"
        className={`h-full w-full object-contain ${imageClassName}`}
        draggable={false}
        src={logoSources[variant]}
      />
    </span>
  );
}
