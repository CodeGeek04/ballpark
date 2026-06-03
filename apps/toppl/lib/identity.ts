"use client";

const KEY = "toppl.identity.v1";

export type Identity = { name: string; avatar: string };

export function loadIdentity(): Identity | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Identity) : null;
  } catch {
    return null;
  }
}

export function saveIdentity(id: Identity) {
  window.localStorage.setItem(KEY, JSON.stringify(id));
}

export const AVATARS = ["🌶️", "🍋", "🥝", "🍑", "🍍", "🌽", "🥑", "🫐", "🥭", "🍒", "🥥", "🍐"];
