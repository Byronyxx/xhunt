'use client';

import React from 'react';

// ── SVG Distortion Filter ── must render once in the document root ──────────
export function GlassFilter() {
  return (
    <svg
      style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
      aria-hidden="true"
    >
      <defs>
        <filter
          id="glass-distortion"
          x="0%" y="0%"
          width="100%" height="100%"
          filterUnits="objectBoundingBox"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.0015 0.006"
            numOctaves="1"
            seed="17"
            result="turbulence"
          />
          <feComponentTransfer in="turbulence" result="mapped">
            <feFuncR type="gamma" amplitude="1" exponent="10" offset="0.5" />
            <feFuncG type="gamma" amplitude="0" exponent="1"  offset="0"   />
            <feFuncB type="gamma" amplitude="0" exponent="1"  offset="0.5" />
          </feComponentTransfer>
          <feGaussianBlur in="turbulence" stdDeviation="3" result="softMap" />
          <feSpecularLighting
            in="softMap"
            surfaceScale="5"
            specularConstant="1"
            specularExponent="100"
            lightingColor="white"
            result="specLight"
          >
            <fePointLight x="-200" y="-200" z="300" />
          </feSpecularLighting>
          <feComposite
            in="specLight"
            operator="arithmetic"
            k1="0" k2="1" k3="1" k4="0"
            result="litImage"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="softMap"
            scale="100"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  );
}

// ── Shared layer styles ──────────────────────────────────────────────────────
const DISTORT_LAYER: React.CSSProperties = {
  position: 'absolute', inset: 0,
  zIndex: 0, borderRadius: 'inherit', overflow: 'hidden',
  backdropFilter: 'blur(4px)',
  WebkitBackdropFilter: 'blur(4px)',
  filter: 'url(#glass-distortion)',
  isolation: 'isolate',
  pointerEvents: 'none',
};

const OVERLAY_LAYER: React.CSSProperties = {
  position: 'absolute', inset: 0,
  zIndex: 1, borderRadius: 'inherit',
  background: 'rgba(10, 18, 38, 0.30)',
  pointerEvents: 'none',
};

const HIGHLIGHT_LAYER: React.CSSProperties = {
  position: 'absolute', inset: 0,
  zIndex: 2, borderRadius: 'inherit',
  boxShadow: [
    'inset 2px 2px 1px rgba(255, 255, 255, 0.22)',
    'inset -1px -1px 1px rgba(255, 255, 255, 0.08)',
    'inset 0 0 0 1px rgba(255, 255, 255, 0.09)',
  ].join(', '),
  pointerEvents: 'none',
};

const CONTENT_LAYER: React.CSSProperties = {
  position: 'relative',
  zIndex: 3,
};

// ── GlassCard ────────────────────────────────────────────────────────────────
interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  as?: 'div' | 'section' | 'article';
}

export function GlassCard({
  children,
  className = '',
  style = {},
  onClick,
  as: Tag = 'div',
}: GlassCardProps) {
  const outer: React.CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    isolation: 'isolate',
    border: '1px solid rgba(255, 255, 255, 0.10)',
    boxShadow: [
      '0 6px 6px rgba(0, 0, 0, 0.25)',
      '0 0 20px rgba(0, 0, 0, 0.14)',
      '0 0 60px rgba(34, 255, 170, 0.04)',
    ].join(', '),
    transition: [
      'transform 0.6s cubic-bezier(0.175, 0.885, 0.32, 2.2)',
      'box-shadow 0.6s cubic-bezier(0.175, 0.885, 0.32, 2.2)',
    ].join(', '),
    ...style,
  };

  return (
    <Tag className={className} style={outer} onClick={onClick}>
      <div style={DISTORT_LAYER}   aria-hidden />
      <div style={OVERLAY_LAYER}   aria-hidden />
      <div style={HIGHLIGHT_LAYER} aria-hidden />
      <div style={CONTENT_LAYER}>
        {children}
      </div>
    </Tag>
  );
}

// ── GlassButton ──────────────────────────────────────────────────────────────
interface GlassButtonProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  accent?: string;
}

export function GlassButton({
  children,
  className = '',
  style = {},
  onClick,
  disabled,
  type = 'button',
  accent = '#22FFAA',
}: GlassButtonProps) {
  const outer: React.CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    isolation: 'isolate',
    border: `1px solid ${accent}30`,
    background: `${accent}0D`,
    boxShadow: [
      '0 4px 6px rgba(0, 0, 0, 0.22)',
      `0 0 24px ${accent}14`,
    ].join(', '),
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: [
      'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 2.2)',
      'box-shadow 0.5s cubic-bezier(0.175, 0.885, 0.32, 2.2)',
    ].join(', '),
    fontFamily: 'inherit',
    opacity: disabled ? 0.5 : 1,
    ...style,
  };

  return (
    <button type={type} className={className} style={outer} onClick={onClick} disabled={disabled}>
      <div style={DISTORT_LAYER}   aria-hidden />
      <div style={{ ...OVERLAY_LAYER, background: `${accent}08` }} aria-hidden />
      <div style={HIGHLIGHT_LAYER} aria-hidden />
      <div style={CONTENT_LAYER}>
        {children}
      </div>
    </button>
  );
}

// ── Inline-compatible liquid glass style (for components using style spread) ─
// Use this for the outermost div when you can't restructure HTML.
// It provides the glass look without pseudo-element layers.
export const LIQUID_GLASS_STYLE: React.CSSProperties = {
  background: 'rgba(10, 18, 38, 0.90)',
  border: '1px solid rgba(255, 255, 255, 0.09)',
  boxShadow: [
    '0 4px 16px rgba(0, 0, 0, 0.3)',
    '0 0 0 0.5px rgba(255, 255, 255, 0.05)',
    'inset 0 1px 0 rgba(255, 255, 255, 0.08)',
  ].join(', '),
};

// Accent-tinted variant (e.g., for mission type cards)
export function liquidGlassAccent(accent: string): React.CSSProperties {
  return {
    ...LIQUID_GLASS_STYLE,
    border: `1px solid ${accent}22`,
    boxShadow: [
      '0 6px 6px rgba(0, 0, 0, 0.25)',
      '0 0 20px rgba(0, 0, 0, 0.12)',
      `0 0 60px ${accent}0A`,
      'inset 2px 2px 1px rgba(255, 255, 255, 0.14)',
      'inset -1px -1px 1px rgba(255, 255, 255, 0.06)',
    ].join(', '),
  };
}
