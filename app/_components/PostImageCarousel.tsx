"use client";

import { Carousel, Typography } from "@/app/_types/mtw";

type PostImageCarouselProps = {
  imageUrls: string[];
  title: string;
  heightClassName?: string;
};

export default function PostImageCarousel({
  imageUrls,
  title,
  heightClassName = "h-56 sm:h-64",
}: PostImageCarouselProps) {
  if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <Carousel
        className={`overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 ${heightClassName}`}
        loop={imageUrls.length > 1}
        autoplay={false}
      >
        {imageUrls.map((imageUrl, index) => (
          <img
            key={`${imageUrl}-${index}`}
            src={imageUrl}
            alt={`${title} image ${index + 1}`}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ))}
      </Carousel>

      {imageUrls.length > 1 ? (
        <Typography variant="small" className="text-slate-500 dark:text-slate-400">
          {imageUrls.length} images
        </Typography>
      ) : null}
    </div>
  );
}
