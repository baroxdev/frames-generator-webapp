import { cn } from "../lib/utils";

export interface TopBannerProps {
  src: string;
  className?: string;
}

const TopBanner = ({ src, className }: TopBannerProps) => {
  return (
    <div className={cn(className)}>
      <img src={src} alt="welcome image" />
    </div>
  );
};

export default TopBanner;
