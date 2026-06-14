import React from "react";

interface ChairsRendererProps {
  capacity: number;
  shape: string;
  activeCount: number;
  pendingCount: number;
}

export const ChairsRenderer: React.FC<ChairsRendererProps> = ({
  capacity,
  shape,
  activeCount,
  pendingCount,
}) => {
  const chairs = [];
  const isRound = shape === "round" || (!shape && capacity <= 4);
  let coords: { x: number; y: number }[] = [];

  if (!isRound) {
    // Linear layout coordinate rules for rectangular tables (x%, y%)
    if (capacity <= 2) {
      coords = [
        { x: 8, y: 50 },
        { x: 92, y: 50 },
      ];
    } else if (capacity === 3) {
      coords = [
        { x: 50, y: 16 },
        { x: 8, y: 50 },
        { x: 92, y: 50 },
      ];
    } else if (capacity === 4) {
      coords = [
        { x: 50, y: 16 },
        { x: 50, y: 84 },
        { x: 8, y: 50 },
        { x: 92, y: 50 },
      ];
    } else if (capacity === 5) {
      coords = [
        { x: 35, y: 16 },
        { x: 65, y: 16 },
        { x: 50, y: 84 },
        { x: 8, y: 50 },
        { x: 92, y: 50 },
      ];
    } else if (capacity === 6) {
      coords = [
        { x: 33, y: 16 },
        { x: 67, y: 16 },
        { x: 33, y: 84 },
        { x: 67, y: 84 },
        { x: 8, y: 50 },
        { x: 92, y: 50 },
      ];
    } else if (capacity === 7) {
      coords = [
        { x: 30, y: 16 },
        { x: 50, y: 16 },
        { x: 70, y: 16 },
        { x: 33, y: 84 },
        { x: 67, y: 84 },
        { x: 8, y: 50 },
        { x: 92, y: 50 },
      ];
    } else if (capacity === 8) {
      coords = [
        { x: 30, y: 16 },
        { x: 50, y: 16 },
        { x: 70, y: 16 },
        { x: 30, y: 84 },
        { x: 50, y: 84 },
        { x: 70, y: 84 },
        { x: 8, y: 50 },
        { x: 92, y: 50 },
      ];
    } else {
      const sideChairs = 2;
      const topBottomChairs = capacity - sideChairs;
      const topChairs = Math.ceil(topBottomChairs / 2);
      const bottomChairs = Math.floor(topBottomChairs / 2);
      coords.push({ x: 8, y: 50 });
      coords.push({ x: 92, y: 50 });
      for (let j = 0; j < topChairs; j++) {
        const tX = topChairs > 1 ? 25 + (j * 50) / (topChairs - 1) : 50;
        coords.push({ x: tX, y: 16 });
      }
      for (let j = 0; j < bottomChairs; j++) {
        const bX = bottomChairs > 1 ? 25 + (j * 50) / (bottomChairs - 1) : 50;
        coords.push({ x: bX, y: 84 });
      }
    }

    return (
      <>
        {coords.slice(0, capacity).map((c, i) => {
          let chairClass = "bg-zinc-200 dark:bg-zinc-700";
          if (i < activeCount) {
            chairClass = "bg-emerald-450 border border-emerald-500 shadow-xs";
          } else if (i < activeCount + pendingCount) {
            chairClass = "bg-amber-450 border border-amber-500 shadow-xs";
          }
          return (
            <div
              key={i}
              className={`absolute w-2 h-2 transition-all rounded-[2px] ${chairClass}`}
              style={{
                left: `${c.x}%`,
                top: `${c.y}%`,
                transform: "translate(-50%, -50%)",
              }}
            />
          );
        })}
      </>
    );
  }

  // Circular table chairs (Trigonometric distribution)
  const radius = 43; // percent radius from center
  for (let i = 0; i < capacity; i++) {
    const angle = (i * 2 * Math.PI) / capacity - Math.PI / 2; // start from top (90 deg)
    const x = 50 + radius * Math.cos(angle);
    const y = 50 + radius * Math.sin(angle);
    let chairClass = "bg-zinc-200 dark:bg-zinc-700";
    if (i < activeCount) {
      chairClass = "bg-emerald-450 border border-emerald-500 shadow-xs";
    } else if (i < activeCount + pendingCount) {
      chairClass = "bg-amber-450 border border-amber-500 shadow-xs";
    }
    chairs.push(
      <div
        key={i}
        className={`absolute w-2 h-2 transition-all rounded-full ${chairClass}`}
        style={{
          left: `${x}%`,
          top: `${y}%`,
          transform: "translate(-50%, -50%)",
        }}
      />
    );
  }
  return <>{chairs}</>;
};
