import { Vec2 } from 'cc';

const EPSILON = 0.0001;

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function normalizeOrFallback(value: Vec2, fallback: Vec2): Vec2 {
  const len = value.length();
  if (len <= EPSILON) {
    return fallback.clone();
  }
  return new Vec2(value.x / len, value.y / len);
}

export function closestPointOnSegment(point: Vec2, start: Vec2, end: Vec2): Vec2 {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq <= EPSILON) {
    return start.clone();
  }

  const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq, 0, 1);
  return new Vec2(start.x + dx * t, start.y + dy * t);
}

export function closestPointOnPolyline(point: Vec2, points: readonly Vec2[]): { point: Vec2; distance: number; segmentIndex: number } | null {
  if (points.length < 2) {
    return null;
  }

  let bestPoint = points[0].clone();
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestIndex = 0;

  for (let i = 1; i < points.length; i += 1) {
    const candidate = closestPointOnSegment(point, points[i - 1], points[i]);
    const candidateDistance = distance(point, candidate);
    if (candidateDistance < bestDistance) {
      bestPoint = candidate;
      bestDistance = candidateDistance;
      bestIndex = i - 1;
    }
  }

  return { point: bestPoint, distance: bestDistance, segmentIndex: bestIndex };
}

export function reflectVelocity(velocity: Vec2, normal: Vec2): Vec2 {
  const unitNormal = normalizeOrFallback(normal, new Vec2(0, 1));
  const dot = velocity.x * unitNormal.x + velocity.y * unitNormal.y;
  return new Vec2(velocity.x - 2 * dot * unitNormal.x, velocity.y - 2 * dot * unitNormal.y);
}

export function circleTouchesPolyline(center: Vec2, radius: number, points: readonly Vec2[]): { normal: Vec2; point: Vec2 } | null {
  const closest = closestPointOnPolyline(center, points);
  if (!closest || closest.distance > radius) {
    return null;
  }

  return {
    normal: normalizeOrFallback(new Vec2(center.x - closest.point.x, center.y - closest.point.y), new Vec2(0, 1)),
    point: closest.point,
  };
}
