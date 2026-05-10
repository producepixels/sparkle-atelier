import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Upload, Download, Sparkles, Settings, Grid3x3, Printer, Palette, Image as ImageIcon, Loader2, History, Trash2, RotateCcw, ChevronDown, ChevronUp, Package, ShoppingCart, X, Search, Check } from 'lucide-react';

// Maps a DMC color's name to a broad family for inventory grouping.
// Order matters — more specific patterns first (e.g. "Plum" before "Purple",
// "Coral" before "Red").
function colorFamily(c) {
  const n = (c.name || '').toLowerCase();
  if (/black|jet/.test(n)) return 'Black';
  if (/snow white|white tin|^white|off white|cream|ivory/.test(n)) return 'White';
  if (/gray|grey|pewter|steel|ash|beaver/.test(n)) return 'Gray';
  if (/coral|salmon|melon|rose|carnation|dusty|alizarin|apple|baby pink|pink/.test(n)) return 'Pink';
  if (/cranberry|garnet|christmas red|coral red|^red\b|red\s|red\b/.test(n)) return 'Red';
  if (/plum/.test(n)) return 'Magenta';
  if (/lavender|violet|orchid/.test(n)) return 'Purple';
  if (/turquoise|aquamarine|sea green|teal/.test(n)) return 'Teal';
  if (/blue|navy|wedgewood|sky|cornflower|delft|royal|peacock|antique/.test(n)) return 'Blue';
  if (/jade|emerald|nile|forest|hunter|pine|chartreuse|kelly|parrot|avocado|olive|moss|pistachio|green/.test(n)) return 'Green';
  if (/yellow|lemon|gold|canary|topaz/.test(n)) return 'Yellow';
  if (/orange|tangerine|pumpkin|burnt|spice|autumn/.test(n)) return 'Orange';
  if (/mahogany|coffee|mocha|hazelnut|brown|tan\b|cocoa|rosewood|desert sand|terra|tawny|beige/.test(n)) return 'Brown';
  return 'Other';
}

const FAMILY_ORDER = ['White', 'Gray', 'Black', 'Red', 'Pink', 'Magenta', 'Purple', 'Blue', 'Teal', 'Green', 'Yellow', 'Orange', 'Brown', 'Other'];

// localStorage-backed inventory of owned DMC codes.
const MY_DRILLS_KEY = 'sparkle-atelier-my-drills';
function loadMyDrills() {
  try {
    const raw = localStorage.getItem(MY_DRILLS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch { return new Set(); }
}
function persistMyDrills(set) {
  try { localStorage.setItem(MY_DRILLS_KEY, JSON.stringify([...set])); }
  catch (e) { console.error('Failed to save drill inventory', e); }
}

function aliExpressUrl(code) {
  return `https://www.aliexpress.com/wholesale?SearchText=${encodeURIComponent(`DMC ${code} diamond painting drill`)}`;
}
function etsyUrl(code) {
  return `https://www.etsy.com/search?q=${encodeURIComponent(`DMC ${code} diamond painting drill`)}`;
}

// === IndexedDB history store ===
// Keeps every generated pattern + the source image so users can re-print
// the legend or chart later without re-uploading. Per-browser, per-device.
const DB_NAME = 'sparkle-atelier';
const DB_VERSION = 1;
const STORE = 'patterns';
const HISTORY_LIMIT = 50;
const HISTORY_CHANNEL = 'sparkle-atelier-history';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbPut(record) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbGetAll() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function dbGet(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbDelete(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbClear() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Re-encode source image as JPEG (or PNG if it has transparency) at max 1600px wide.
// Phone photos are 4-12MB raw; this knocks them down to ~0.5-1.5MB so 50 entries fit comfortably.
function compressForStorage(dataUrl, maxDim = 1600, quality = 0.85) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      // PNG inputs may have transparency; keep PNG. Anything else, JPEG for size.
      const fmt = dataUrl.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
      resolve({ dataUrl: c.toDataURL(fmt, quality), width: img.width, height: img.height });
    };
    img.onerror = () => resolve({ dataUrl, width: 0, height: 0 });
    img.src = dataUrl;
  });
}

function formatHistoryDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yest = new Date(now); yest.setDate(yest.getDate() - 1);
  const isYesterday = d.toDateString() === yest.toDateString();
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return `Today, ${time}`;
  if (isYesterday) return `Yesterday, ${time}`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
}

// 200px-wide JPEG thumb for the history list. Keeps the dropdown snappy
// even with 50 entries on slower phones.
function makeThumbnail(dataUrl, maxDim = 200) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// === DMC Color Palette ===
// Curated list of common DMC floss colors with RGB values.
// Each diamond painting kit uses DMC numbers as the universal standard.
const DMC_COLORS = [
  { code: 'Blanc', name: 'White', r: 252, g: 251, b: 248 },
  { code: 'Ecru', name: 'Ecru', r: 240, g: 234, b: 218 },
  { code: 'B5200', name: 'Snow White', r: 255, g: 255, b: 255 },
  { code: '150', name: 'Dusty Rose Ult Vy Dk', r: 171, g: 2, b: 73 },
  { code: '151', name: 'Dusty Rose Vry Lt', r: 240, g: 206, b: 212 },
  { code: '152', name: 'Shell Pink Med Light', r: 226, g: 160, b: 153 },
  { code: '153', name: 'Violet Very Light', r: 230, g: 204, b: 217 },
  { code: '154', name: 'Grape Very Dark', r: 87, g: 36, b: 51 },
  { code: '155', name: 'Blue Violet Med Dark', r: 152, g: 145, b: 182 },
  { code: '156', name: 'Blue Violet Med Lt', r: 163, g: 174, b: 209 },
  { code: '157', name: 'Cornflower Blue Vy Lt', r: 187, g: 195, b: 217 },
  { code: '158', name: 'Cornflower Blu M V D', r: 76, g: 82, b: 110 },
  { code: '159', name: 'Blue Gray Light', r: 199, g: 202, b: 215 },
  { code: '160', name: 'Blue Gray Medium', r: 153, g: 159, b: 183 },
  { code: '161', name: 'Blue Gray', r: 120, g: 128, b: 164 },
  { code: '162', name: 'Blue Ultra Very Light', r: 219, g: 236, b: 245 },
  { code: '163', name: 'Celadon Green Md', r: 77, g: 131, b: 97 },
  { code: '164', name: 'Forest Green Lt', r: 200, g: 216, b: 184 },
  { code: '165', name: 'Moss Green Vy Lt', r: 239, g: 244, b: 164 },
  { code: '166', name: 'Moss Green Md Lt', r: 192, g: 200, b: 64 },
  { code: '167', name: 'Yellow Beige V Dk', r: 167, g: 124, b: 73 },
  { code: '168', name: 'Pewter Very Light', r: 209, g: 209, b: 209 },
  { code: '169', name: 'Pewter Light', r: 132, g: 132, b: 132 },
  { code: '208', name: 'Lavender Very Dark', r: 131, g: 91, b: 139 },
  { code: '209', name: 'Lavender Dark', r: 163, g: 123, b: 167 },
  { code: '210', name: 'Lavender Medium', r: 195, g: 159, b: 195 },
  { code: '211', name: 'Lavender Light', r: 227, g: 203, b: 227 },
  { code: '221', name: 'Shell Pink Vy Dk', r: 136, g: 62, b: 67 },
  { code: '223', name: 'Shell Pink Light', r: 204, g: 132, b: 124 },
  { code: '224', name: 'Shell Pink Very Light', r: 235, g: 183, b: 175 },
  { code: '225', name: 'Shell Pink Ult Vy Lt', r: 255, g: 223, b: 213 },
  { code: '300', name: 'Mahogany Vy Dk', r: 111, g: 47, b: 0 },
  { code: '301', name: 'Mahogany Med', r: 179, g: 95, b: 43 },
  { code: '304', name: 'Red Medium', r: 183, g: 31, b: 51 },
  { code: '307', name: 'Lemon', r: 253, g: 237, b: 84 },
  { code: '309', name: 'Rose Dark', r: 214, g: 43, b: 91 },
  { code: '310', name: 'Black', r: 0, g: 0, b: 0 },
  { code: '311', name: 'Wedgewood Ult VyDk', r: 28, g: 80, b: 102 },
  { code: '312', name: 'Baby Blue Very Dark', r: 53, g: 102, b: 139 },
  { code: '315', name: 'Antique Mauve Md Dk', r: 129, g: 73, b: 82 },
  { code: '316', name: 'Antique Mauve Med', r: 183, g: 115, b: 127 },
  { code: '317', name: 'Pewter Gray', r: 108, g: 108, b: 108 },
  { code: '318', name: 'Steel Gray Lt', r: 171, g: 171, b: 171 },
  { code: '319', name: 'Pistachio Grn Vy Dk', r: 32, g: 95, b: 46 },
  { code: '320', name: 'Pistachio Green Med', r: 105, g: 136, b: 90 },
  { code: '321', name: 'Red', r: 199, g: 43, b: 59 },
  { code: '322', name: 'Baby Blue Dark', r: 90, g: 143, b: 184 },
  { code: '326', name: 'Rose Very Dark', r: 179, g: 59, b: 75 },
  { code: '327', name: 'Violet Dark', r: 99, g: 54, b: 102 },
  { code: '333', name: 'Blue Violet Very Dark', r: 92, g: 84, b: 120 },
  { code: '334', name: 'Baby Blue Medium', r: 115, g: 159, b: 193 },
  { code: '335', name: 'Rose', r: 238, g: 84, b: 110 },
  { code: '336', name: 'Navy Blue', r: 37, g: 59, b: 115 },
  { code: '340', name: 'Blue Violet Medium', r: 173, g: 167, b: 199 },
  { code: '341', name: 'Blue Violet Light', r: 183, g: 191, b: 221 },
  { code: '347', name: 'Salmon Very Dark', r: 191, g: 45, b: 45 },
  { code: '349', name: 'Coral Dark', r: 210, g: 16, b: 53 },
  { code: '350', name: 'Coral Medium', r: 224, g: 72, b: 72 },
  { code: '351', name: 'Coral', r: 233, g: 106, b: 103 },
  { code: '352', name: 'Coral Light', r: 253, g: 156, b: 151 },
  { code: '353', name: 'Peach', r: 254, g: 215, b: 204 },
  { code: '355', name: 'Terra Cotta Dark', r: 152, g: 68, b: 54 },
  { code: '356', name: 'Terra Cotta Med', r: 197, g: 106, b: 91 },
  { code: '367', name: 'Pistachio Green Dk', r: 97, g: 122, b: 82 },
  { code: '368', name: 'Pistachio Green Lt', r: 166, g: 194, b: 152 },
  { code: '369', name: 'Pistachio Green Vy Lt', r: 215, g: 237, b: 204 },
  { code: '370', name: 'Mustard Medium', r: 184, g: 157, b: 100 },
  { code: '371', name: 'Mustard', r: 191, g: 166, b: 113 },
  { code: '372', name: 'Mustard Lt', r: 204, g: 183, b: 132 },
  { code: '400', name: 'Mahogany Dark', r: 143, g: 67, b: 15 },
  { code: '402', name: 'Mahogany Vy Lt', r: 247, g: 167, b: 119 },
  { code: '407', name: 'Desert Sand Med', r: 187, g: 129, b: 97 },
  { code: '413', name: 'Pewter Gray Dark', r: 86, g: 86, b: 86 },
  { code: '414', name: 'Steel Gray Dk', r: 140, g: 140, b: 140 },
  { code: '415', name: 'Pearl Gray', r: 211, g: 211, b: 214 },
  { code: '420', name: 'Hazelnut Brown Dk', r: 160, g: 112, b: 66 },
  { code: '422', name: 'Hazelnut Brown Lt', r: 198, g: 159, b: 123 },
  { code: '433', name: 'Brown Med', r: 122, g: 69, b: 31 },
  { code: '434', name: 'Brown Light', r: 152, g: 94, b: 51 },
  { code: '435', name: 'Brown Very Light', r: 184, g: 119, b: 72 },
  { code: '436', name: 'Tan', r: 203, g: 144, b: 81 },
  { code: '437', name: 'Tan Light', r: 228, g: 187, b: 142 },
  { code: '444', name: 'Lemon Dark', r: 255, g: 214, b: 0 },
  { code: '445', name: 'Lemon Light', r: 255, g: 251, b: 139 },
  { code: '451', name: 'Shell Gray Dark', r: 145, g: 123, b: 115 },
  { code: '452', name: 'Shell Gray Med', r: 192, g: 179, b: 174 },
  { code: '453', name: 'Shell Gray Light', r: 215, g: 206, b: 203 },
  { code: '469', name: 'Avocado Green', r: 114, g: 132, b: 60 },
  { code: '470', name: 'Avocado Grn Lt', r: 148, g: 171, b: 79 },
  { code: '471', name: 'Avocado Grn V Lt', r: 174, g: 191, b: 121 },
  { code: '472', name: 'Avocado Grn U Lt', r: 216, g: 228, b: 152 },
  { code: '498', name: 'Red Dark', r: 167, g: 19, b: 43 },
  { code: '500', name: 'Blue Green Vy Dk', r: 4, g: 77, b: 51 },
  { code: '501', name: 'Blue Green Dark', r: 57, g: 111, b: 82 },
  { code: '502', name: 'Blue Green', r: 91, g: 144, b: 113 },
  { code: '503', name: 'Blue Green Med', r: 123, g: 172, b: 148 },
  { code: '504', name: 'Blue Green Vy Lt', r: 196, g: 222, b: 204 },
  { code: '505', name: 'Jade Green', r: 51, g: 131, b: 98 },
  { code: '517', name: 'Wedgewood Dark', r: 59, g: 118, b: 143 },
  { code: '518', name: 'Wedgewood Light', r: 79, g: 147, b: 167 },
  { code: '519', name: 'Sky Blue', r: 126, g: 177, b: 200 },
  { code: '520', name: 'Fern Green Dark', r: 102, g: 109, b: 79 },
  { code: '522', name: 'Fern Green', r: 150, g: 158, b: 126 },
  { code: '523', name: 'Fern Green Lt', r: 171, g: 177, b: 151 },
  { code: '524', name: 'Fern Green Vy Lt', r: 196, g: 205, b: 172 },
  { code: '535', name: 'Ash Gray Vy Lt', r: 99, g: 100, b: 88 },
  { code: '543', name: 'Beige Brown Ult Vy Lt', r: 242, g: 227, b: 206 },
  { code: '550', name: 'Violet Very Dark', r: 92, g: 24, b: 78 },
  { code: '552', name: 'Violet Medium', r: 128, g: 58, b: 107 },
  { code: '553', name: 'Violet', r: 163, g: 99, b: 139 },
  { code: '554', name: 'Violet Light', r: 219, g: 179, b: 203 },
  { code: '561', name: 'Celadon Green VD', r: 44, g: 106, b: 69 },
  { code: '562', name: 'Jade Medium', r: 83, g: 151, b: 106 },
  { code: '563', name: 'Jade Light', r: 143, g: 192, b: 152 },
  { code: '564', name: 'Jade Very Light', r: 167, g: 205, b: 175 },
  { code: '580', name: 'Moss Green Dk', r: 136, g: 141, b: 51 },
  { code: '581', name: 'Moss Green', r: 167, g: 174, b: 56 },
  { code: '597', name: 'Turquoise', r: 91, g: 163, b: 179 },
  { code: '598', name: 'Turquoise Light', r: 144, g: 195, b: 204 },
  { code: '600', name: 'Cranberry Very Dark', r: 205, g: 47, b: 99 },
  { code: '601', name: 'Cranberry Dark', r: 209, g: 40, b: 106 },
  { code: '602', name: 'Cranberry Medium', r: 226, g: 72, b: 116 },
  { code: '603', name: 'Cranberry', r: 255, g: 164, b: 190 },
  { code: '604', name: 'Cranberry Light', r: 255, g: 176, b: 190 },
  { code: '605', name: 'Cranberry Very Light', r: 255, g: 192, b: 205 },
  { code: '606', name: 'Orange Red Bright', r: 250, g: 50, b: 3 },
  { code: '608', name: 'Burnt Orange Bright', r: 253, g: 93, b: 53 },
  { code: '610', name: 'Drab Brown Dk', r: 121, g: 96, b: 71 },
  { code: '611', name: 'Drab Brown', r: 150, g: 118, b: 86 },
  { code: '612', name: 'Drab Brown Lt', r: 188, g: 154, b: 120 },
  { code: '613', name: 'Drab Brown V Lt', r: 220, g: 196, b: 170 },
  { code: '632', name: 'Desert Sand Ult Vy Dk', r: 135, g: 85, b: 57 },
  { code: '640', name: 'Beige Gray Vy Dk', r: 133, g: 123, b: 97 },
  { code: '642', name: 'Beige Gray Dark', r: 164, g: 152, b: 120 },
  { code: '644', name: 'Beige Gray Med', r: 221, g: 216, b: 203 },
  { code: '645', name: 'Beaver Gray Vy Dk', r: 110, g: 101, b: 92 },
  { code: '646', name: 'Beaver Gray Dk', r: 135, g: 125, b: 115 },
  { code: '647', name: 'Beaver Gray Med', r: 176, g: 166, b: 156 },
  { code: '648', name: 'Beaver Gray Lt', r: 188, g: 180, b: 172 },
  { code: '666', name: 'Bright Red', r: 227, g: 29, b: 66 },
  { code: '676', name: 'Old Gold Lt', r: 229, g: 206, b: 151 },
  { code: '677', name: 'Old Gold Vy Lt', r: 245, g: 236, b: 203 },
  { code: '680', name: 'Old Gold Dark', r: 188, g: 141, b: 14 },
  { code: '699', name: 'Green', r: 5, g: 101, b: 23 },
  { code: '700', name: 'Green Bright', r: 7, g: 115, b: 27 },
  { code: '701', name: 'Green Light', r: 63, g: 143, b: 41 },
  { code: '702', name: 'Kelly Green', r: 71, g: 167, b: 47 },
  { code: '703', name: 'Chartreuse', r: 123, g: 181, b: 71 },
  { code: '704', name: 'Chartreuse Bright', r: 158, g: 207, b: 52 },
  { code: '712', name: 'Cream', r: 255, g: 251, b: 239 },
  { code: '718', name: 'Plum', r: 156, g: 36, b: 98 },
  { code: '720', name: 'Orange Spice Dark', r: 229, g: 92, b: 31 },
  { code: '721', name: 'Orange Spice Med', r: 242, g: 120, b: 66 },
  { code: '722', name: 'Orange Spice Light', r: 247, g: 151, b: 111 },
  { code: '725', name: 'Topaz Med Lt', r: 255, g: 200, b: 64 },
  { code: '726', name: 'Topaz Light', r: 253, g: 215, b: 85 },
  { code: '727', name: 'Topaz Vy Lt', r: 255, g: 241, b: 175 },
  { code: '728', name: 'Topaz', r: 228, g: 180, b: 104 },
  { code: '729', name: 'Old Gold Medium', r: 208, g: 165, b: 62 },
  { code: '730', name: 'Olive Green V Dk', r: 130, g: 123, b: 48 },
  { code: '731', name: 'Olive Green Dk', r: 147, g: 139, b: 55 },
  { code: '732', name: 'Olive Green', r: 148, g: 140, b: 54 },
  { code: '733', name: 'Olive Green Md', r: 188, g: 179, b: 76 },
  { code: '734', name: 'Olive Green Lt', r: 199, g: 192, b: 119 },
  { code: '738', name: 'Tan Very Light', r: 236, g: 204, b: 158 },
  { code: '739', name: 'Tan Ult Vy Lt', r: 248, g: 228, b: 200 },
  { code: '740', name: 'Tangerine', r: 255, g: 139, b: 0 },
  { code: '741', name: 'Tangerine Med', r: 255, g: 163, b: 43 },
  { code: '742', name: 'Tangerine Light', r: 255, g: 191, b: 87 },
  { code: '743', name: 'Yellow Med', r: 254, g: 211, b: 118 },
  { code: '744', name: 'Yellow Pale', r: 255, g: 231, b: 147 },
  { code: '745', name: 'Yellow Pale Light', r: 255, g: 233, b: 173 },
  { code: '746', name: 'Off White', r: 252, g: 252, b: 238 },
  { code: '747', name: 'Peacock Blue Vy Lt', r: 229, g: 252, b: 253 },
  { code: '754', name: 'Peach Light', r: 247, g: 203, b: 191 },
  { code: '758', name: 'Terra Cotta Vy Lt', r: 238, g: 170, b: 155 },
  { code: '760', name: 'Salmon', r: 245, g: 173, b: 173 },
  { code: '761', name: 'Salmon Light', r: 255, g: 201, b: 201 },
  { code: '762', name: 'Pearl Gray Vy Lt', r: 236, g: 236, b: 236 },
  { code: '772', name: 'Yellow Green Vy Lt', r: 228, g: 236, b: 212 },
  { code: '775', name: 'Baby Blue Very Light', r: 217, g: 235, b: 241 },
  { code: '776', name: 'Pink Medium', r: 252, g: 176, b: 185 },
  { code: '777', name: 'Raspberry Very Dark', r: 145, g: 53, b: 70 },
  { code: '778', name: 'Antique Mauve Vy Lt', r: 223, g: 179, b: 187 },
  { code: '779', name: 'Cocoa Dark', r: 98, g: 75, b: 69 },
  { code: '780', name: 'Topaz Ultra Vy Dk', r: 148, g: 99, b: 26 },
  { code: '781', name: 'Topaz Very Dark', r: 162, g: 109, b: 32 },
  { code: '782', name: 'Topaz Dark', r: 174, g: 119, b: 32 },
  { code: '783', name: 'Topaz Medium', r: 206, g: 145, b: 36 },
  { code: '791', name: 'Cornflower Blue V D', r: 70, g: 69, b: 99 },
  { code: '792', name: 'Cornflower Blue Dark', r: 85, g: 91, b: 123 },
  { code: '793', name: 'Cornflower Blue Med', r: 112, g: 125, b: 162 },
  { code: '794', name: 'Cornflower Blue Light', r: 143, g: 156, b: 193 },
  { code: '796', name: 'Royal Blue Dark', r: 17, g: 65, b: 109 },
  { code: '797', name: 'Royal Blue', r: 19, g: 71, b: 125 },
  { code: '798', name: 'Delft Blue Dark', r: 70, g: 106, b: 142 },
  { code: '799', name: 'Delft Blue Medium', r: 116, g: 142, b: 182 },
  { code: '800', name: 'Delft Blue Pale', r: 192, g: 204, b: 222 },
  { code: '801', name: 'Coffee Brown Dk', r: 101, g: 57, b: 25 },
  { code: '803', name: 'Baby Blue Ult Vy Dk', r: 44, g: 89, b: 124 },
  { code: '806', name: 'Peacock Blue Dark', r: 61, g: 149, b: 165 },
  { code: '807', name: 'Peacock Blue', r: 100, g: 171, b: 186 },
  { code: '809', name: 'Delft Blue', r: 148, g: 168, b: 198 },
  { code: '813', name: 'Blue Light', r: 161, g: 194, b: 215 },
  { code: '814', name: 'Garnet Dark', r: 123, g: 0, b: 27 },
  { code: '815', name: 'Garnet Medium', r: 135, g: 7, b: 31 },
  { code: '816', name: 'Garnet', r: 151, g: 11, b: 35 },
  { code: '817', name: 'Coral Red Very Dark', r: 187, g: 5, b: 31 },
  { code: '818', name: 'Baby Pink', r: 255, g: 223, b: 217 },
  { code: '819', name: 'Baby Pink Light', r: 255, g: 238, b: 235 },
  { code: '820', name: 'Royal Blue Very Dark', r: 14, g: 54, b: 92 },
  { code: '822', name: 'Beige Gray Light', r: 231, g: 226, b: 211 },
  { code: '823', name: 'Navy Blue Dark', r: 33, g: 48, b: 99 },
  { code: '824', name: 'Blue Very Dark', r: 57, g: 105, b: 135 },
  { code: '825', name: 'Blue Dark', r: 71, g: 129, b: 165 },
  { code: '826', name: 'Blue Medium', r: 107, g: 158, b: 191 },
  { code: '827', name: 'Blue Very Light', r: 189, g: 221, b: 237 },
  { code: '828', name: 'Sky Blue Vy Lt', r: 197, g: 232, b: 237 },
  { code: '829', name: 'Golden Olive Vy Dk', r: 126, g: 107, b: 66 },
  { code: '830', name: 'Golden Olive Dk', r: 141, g: 120, b: 75 },
  { code: '831', name: 'Golden Olive Md', r: 170, g: 143, b: 86 },
  { code: '832', name: 'Golden Olive', r: 189, g: 155, b: 81 },
  { code: '833', name: 'Golden Olive Lt', r: 200, g: 171, b: 108 },
  { code: '834', name: 'Golden Olive Vy Lt', r: 219, g: 190, b: 127 },
  { code: '838', name: 'Beige Brown Vy Dk', r: 89, g: 73, b: 55 },
  { code: '839', name: 'Beige Brown Dk', r: 103, g: 85, b: 65 },
  { code: '840', name: 'Beige Brown Med', r: 154, g: 124, b: 92 },
  { code: '841', name: 'Beige Brown Lt', r: 182, g: 155, b: 126 },
  { code: '842', name: 'Beige Brown Vy Lt', r: 209, g: 186, b: 161 },
  { code: '844', name: 'Beaver Gray Ult Dk', r: 72, g: 72, b: 72 },
  { code: '869', name: 'Hazelnut Brown V Dk', r: 131, g: 94, b: 57 },
  { code: '890', name: 'Pistachio Grn Ult V D', r: 23, g: 73, b: 35 },
  { code: '891', name: 'Carnation Dark', r: 255, g: 87, b: 115 },
  { code: '892', name: 'Carnation Medium', r: 255, g: 121, b: 140 },
  { code: '893', name: 'Carnation Light', r: 252, g: 144, b: 162 },
  { code: '894', name: 'Carnation Very Light', r: 255, g: 178, b: 187 },
  { code: '895', name: 'Hunter Green Vy Dk', r: 27, g: 83, b: 0 },
  { code: '898', name: 'Coffee Brown Vy Dk', r: 73, g: 42, b: 19 },
  { code: '899', name: 'Rose Medium', r: 242, g: 118, b: 136 },
  { code: '900', name: 'Burnt Orange Dark', r: 209, g: 88, b: 7 },
  { code: '902', name: 'Garnet Very Dark', r: 130, g: 38, b: 55 },
  { code: '904', name: 'Parrot Green V Dk', r: 85, g: 120, b: 34 },
  { code: '905', name: 'Parrot Green Dk', r: 98, g: 138, b: 40 },
  { code: '906', name: 'Parrot Green Md', r: 127, g: 179, b: 53 },
  { code: '907', name: 'Parrot Green Lt', r: 199, g: 230, b: 102 },
  { code: '909', name: 'Emerald Green Vy Dk', r: 21, g: 111, b: 73 },
  { code: '910', name: 'Emerald Green Dark', r: 24, g: 126, b: 86 },
  { code: '911', name: 'Emerald Green Med', r: 24, g: 144, b: 101 },
  { code: '912', name: 'Emerald Green Lt', r: 27, g: 157, b: 107 },
  { code: '913', name: 'Nile Green Med', r: 109, g: 171, b: 119 },
  { code: '915', name: 'Plum Dark', r: 130, g: 0, b: 67 },
  { code: '917', name: 'Plum Medium', r: 155, g: 19, b: 89 },
  { code: '918', name: 'Red Copper Dark', r: 130, g: 52, b: 10 },
  { code: '919', name: 'Red Copper', r: 166, g: 69, b: 16 },
  { code: '920', name: 'Copper Med', r: 172, g: 84, b: 20 },
  { code: '921', name: 'Copper', r: 198, g: 98, b: 24 },
  { code: '922', name: 'Copper Light', r: 226, g: 115, b: 35 },
  { code: '924', name: 'Gray Green Vy Dark', r: 86, g: 106, b: 106 },
  { code: '926', name: 'Gray Green Med', r: 152, g: 174, b: 174 },
  { code: '927', name: 'Gray Green Light', r: 189, g: 203, b: 203 },
  { code: '928', name: 'Gray Green Vy Lt', r: 221, g: 227, b: 227 },
  { code: '930', name: 'Antique Blue Dark', r: 69, g: 92, b: 113 },
  { code: '931', name: 'Antique Blue Medium', r: 106, g: 133, b: 158 },
  { code: '932', name: 'Antique Blue Light', r: 162, g: 181, b: 198 },
  { code: '934', name: 'Avocado Grn Black', r: 49, g: 57, b: 25 },
  { code: '935', name: 'Avocado Green Dk', r: 66, g: 77, b: 33 },
  { code: '936', name: 'Avocado Grn V Dk', r: 76, g: 88, b: 38 },
  { code: '937', name: 'Avocado Green Md', r: 98, g: 113, b: 51 },
  { code: '938', name: 'Coffee Brown Ult Dk', r: 54, g: 31, b: 14 },
  { code: '939', name: 'Navy Blue Very Dark', r: 27, g: 40, b: 83 },
  { code: '943', name: 'Green Bright Md', r: 61, g: 147, b: 132 },
  { code: '945', name: 'Tawny', r: 251, g: 213, b: 187 },
  { code: '946', name: 'Burnt Orange Med', r: 235, g: 99, b: 7 },
  { code: '947', name: 'Burnt Orange', r: 255, g: 123, b: 77 },
  { code: '948', name: 'Peach Very Light', r: 254, g: 231, b: 218 },
  { code: '950', name: 'Desert Sand Light', r: 238, g: 211, b: 196 },
  { code: '951', name: 'Tawny Light', r: 255, g: 226, b: 207 },
  { code: '954', name: 'Nile Green', r: 136, g: 186, b: 145 },
  { code: '955', name: 'Nile Green Light', r: 162, g: 214, b: 173 },
  { code: '956', name: 'Geranium', r: 255, g: 145, b: 145 },
  { code: '957', name: 'Geranium Pale', r: 253, g: 181, b: 181 },
  { code: '958', name: 'Sea Green Dark', r: 62, g: 182, b: 161 },
  { code: '959', name: 'Sea Green Med', r: 89, g: 199, b: 180 },
  { code: '961', name: 'Dusty Rose Dark', r: 207, g: 115, b: 115 },
  { code: '962', name: 'Dusty Rose Medium', r: 230, g: 138, b: 138 },
  { code: '963', name: 'Dusty Rose Ult Vy Lt', r: 255, g: 215, b: 215 },
  { code: '964', name: 'Sea Green Light', r: 169, g: 226, b: 216 },
  { code: '966', name: 'Jade Ultra Vy Lt', r: 185, g: 215, b: 192 },
  { code: '967', name: 'Apricot Very Light', r: 255, g: 222, b: 213 },
  { code: '970', name: 'Pumpkin Light', r: 247, g: 139, b: 19 },
  { code: '971', name: 'Pumpkin', r: 246, g: 127, b: 0 },
  { code: '972', name: 'Canary Deep', r: 255, g: 181, b: 21 },
  { code: '973', name: 'Canary Bright', r: 255, g: 227, b: 0 },
  { code: '975', name: 'Golden Brown Dk', r: 145, g: 79, b: 18 },
  { code: '976', name: 'Golden Brown Med', r: 194, g: 129, b: 66 },
  { code: '977', name: 'Golden Brown Light', r: 220, g: 156, b: 86 },
  { code: '986', name: 'Forest Green Vy Dk', r: 64, g: 82, b: 48 },
  { code: '987', name: 'Forest Green Dk', r: 88, g: 113, b: 65 },
  { code: '988', name: 'Forest Green Med', r: 115, g: 139, b: 91 },
  { code: '989', name: 'Forest Green', r: 141, g: 166, b: 117 },
  { code: '991', name: 'Aquamarine Dk', r: 71, g: 123, b: 110 },
  { code: '992', name: 'Aquamarine Lt', r: 111, g: 174, b: 159 },
  { code: '993', name: 'Aquamarine Vy Lt', r: 144, g: 192, b: 180 },
  { code: '995', name: 'Electric Blue Dark', r: 38, g: 150, b: 182 },
  { code: '996', name: 'Electric Blue Medium', r: 48, g: 194, b: 236 },
  { code: '3011', name: 'Khaki Green Dk', r: 137, g: 138, b: 88 },
  { code: '3012', name: 'Khaki Green Md', r: 166, g: 167, b: 93 },
  { code: '3013', name: 'Khaki Green Lt', r: 185, g: 185, b: 130 },
  { code: '3021', name: 'Brown Gray Vy Dk', r: 79, g: 75, b: 65 },
  { code: '3022', name: 'Brown Gray Med', r: 142, g: 144, b: 120 },
  { code: '3023', name: 'Brown Gray Light', r: 177, g: 170, b: 151 },
  { code: '3024', name: 'Brown Gray Vy Lt', r: 235, g: 234, b: 231 },
  { code: '3031', name: 'Mocha Brown Vy Dk', r: 75, g: 60, b: 42 },
  { code: '3032', name: 'Mocha Brown Med', r: 179, g: 159, b: 139 },
  { code: '3033', name: 'Mocha Brown Vy Lt', r: 227, g: 216, b: 204 },
  { code: '3041', name: 'Antique Violet Medium', r: 149, g: 111, b: 124 },
  { code: '3042', name: 'Antique Violet Light', r: 183, g: 157, b: 167 },
  { code: '3045', name: 'Yellow Beige Dk', r: 188, g: 150, b: 106 },
  { code: '3046', name: 'Yellow Beige Md', r: 216, g: 188, b: 154 },
  { code: '3047', name: 'Yellow Beige Lt', r: 231, g: 214, b: 193 },
  { code: '3051', name: 'Green Gray Dk', r: 95, g: 102, b: 72 },
  { code: '3052', name: 'Green Gray Md', r: 136, g: 146, b: 104 },
  { code: '3053', name: 'Green Gray', r: 156, g: 164, b: 130 },
  { code: '3064', name: 'Desert Sand', r: 196, g: 142, b: 112 },
  { code: '3072', name: 'Beaver Gray Vy Lt', r: 230, g: 232, b: 232 },
  { code: '3078', name: 'Golden Yellow Vy Lt', r: 253, g: 249, b: 205 },
  { code: '3325', name: 'Baby Blue Light', r: 184, g: 210, b: 230 },
  { code: '3326', name: 'Rose Light', r: 251, g: 173, b: 180 },
  { code: '3328', name: 'Salmon Dark', r: 227, g: 109, b: 109 },
  { code: '3340', name: 'Apricot Med', r: 255, g: 131, b: 111 },
  { code: '3341', name: 'Apricot', r: 252, g: 171, b: 152 },
  { code: '3345', name: 'Hunter Green Dk', r: 27, g: 89, b: 21 },
  { code: '3346', name: 'Hunter Green', r: 64, g: 106, b: 58 },
  { code: '3347', name: 'Yellow Green Med', r: 113, g: 147, b: 92 },
  { code: '3348', name: 'Yellow Green Lt', r: 204, g: 217, b: 177 },
  { code: '3350', name: 'Dusty Rose Ultra Dark', r: 188, g: 67, b: 101 },
  { code: '3354', name: 'Dusty Rose Light', r: 228, g: 166, b: 172 },
  { code: '3362', name: 'Pine Green Dk', r: 94, g: 107, b: 71 },
  { code: '3363', name: 'Pine Green Md', r: 114, g: 130, b: 86 },
  { code: '3364', name: 'Pine Green', r: 131, g: 151, b: 95 },
  { code: '3371', name: 'Black Brown', r: 30, g: 17, b: 8 },
  { code: '3607', name: 'Plum Light', r: 197, g: 73, b: 137 },
  { code: '3608', name: 'Plum Very Light', r: 234, g: 156, b: 196 },
  { code: '3609', name: 'Plum Ultra Light', r: 244, g: 174, b: 213 },
  { code: '3685', name: 'Mauve Very Dark', r: 136, g: 21, b: 49 },
  { code: '3687', name: 'Mauve', r: 201, g: 107, b: 112 },
  { code: '3688', name: 'Mauve Medium', r: 231, g: 169, b: 172 },
  { code: '3689', name: 'Mauve Light', r: 251, g: 191, b: 194 },
  { code: '3705', name: 'Melon Dark', r: 255, g: 121, b: 146 },
  { code: '3706', name: 'Melon Medium', r: 255, g: 173, b: 188 },
  { code: '3708', name: 'Melon Light', r: 255, g: 203, b: 213 },
  { code: '3712', name: 'Salmon Medium', r: 241, g: 135, b: 135 },
  { code: '3713', name: 'Salmon Very Light', r: 255, g: 226, b: 226 },
  { code: '3716', name: 'Dusty Rose Med Vy Lt', r: 255, g: 189, b: 189 },
  { code: '3721', name: 'Shell Pink Dark', r: 161, g: 75, b: 81 },
  { code: '3722', name: 'Shell Pink Med', r: 188, g: 108, b: 100 },
  { code: '3726', name: 'Antique Mauve Dark', r: 155, g: 91, b: 102 },
  { code: '3727', name: 'Antique Mauve Light', r: 219, g: 169, b: 178 },
  { code: '3731', name: 'Dusty Rose Very Dark', r: 218, g: 103, b: 131 },
  { code: '3733', name: 'Dusty Rose', r: 232, g: 135, b: 155 },
  { code: '3740', name: 'Antique Violet Dark', r: 120, g: 87, b: 98 },
  { code: '3743', name: 'Antique Violet Vy Lt', r: 215, g: 203, b: 211 },
  { code: '3746', name: 'Blue Violet Dark', r: 119, g: 107, b: 152 },
  { code: '3747', name: 'Blue Violet Vy Lt', r: 211, g: 215, b: 237 },
  { code: '3750', name: 'Antique Blue Very Dk', r: 56, g: 76, b: 94 },
  { code: '3752', name: 'Antique Blue Very Lt', r: 199, g: 209, b: 219 },
  { code: '3753', name: 'Antique Blue Ult Vy Lt', r: 219, g: 226, b: 233 },
  { code: '3755', name: 'Baby Blue', r: 147, g: 180, b: 206 },
  { code: '3756', name: 'Baby Blue Ult Vy Lt', r: 238, g: 252, b: 252 },
  { code: '3760', name: 'Wedgewood Med', r: 62, g: 133, b: 162 },
  { code: '3761', name: 'Sky Blue Light', r: 172, g: 216, b: 226 },
  { code: '3765', name: 'Peacock Blue Vy Dk', r: 52, g: 127, b: 140 },
  { code: '3766', name: 'Peacock Blue Light', r: 153, g: 207, b: 217 },
  { code: '3768', name: 'Gray Green Dark', r: 101, g: 127, b: 127 },
  { code: '3770', name: 'Tawny Vy Light', r: 255, g: 238, b: 227 },
  { code: '3771', name: 'Terra Cotta Ult Vy Lt', r: 244, g: 187, b: 169 },
  { code: '3772', name: 'Desert Sand Vy Dk', r: 160, g: 108, b: 80 },
  { code: '3773', name: 'Desert Sand Dark', r: 182, g: 117, b: 82 },
  { code: '3774', name: 'Desert Sand Vy Lt', r: 243, g: 225, b: 215 },
  { code: '3776', name: 'Mahogany Light', r: 207, g: 121, b: 57 },
  { code: '3777', name: 'Terra Cotta Vy Dk', r: 134, g: 48, b: 34 },
  { code: '3778', name: 'Terra Cotta Light', r: 217, g: 137, b: 120 },
  { code: '3779', name: 'Rosewood Ult Vy Lt', r: 248, g: 202, b: 200 },
  { code: '3781', name: 'Mocha Brown Dk', r: 107, g: 87, b: 67 },
  { code: '3782', name: 'Mocha Brown Lt', r: 210, g: 188, b: 166 },
  { code: '3787', name: 'Brown Gray Dark', r: 98, g: 93, b: 80 },
  { code: '3790', name: 'Beige Gray Ult Dk', r: 127, g: 106, b: 85 },
  { code: '3799', name: 'Pewter Gray Vy Dk', r: 66, g: 66, b: 66 },
  { code: '3801', name: 'Melon Very Dark', r: 231, g: 73, b: 103 },
  { code: '3802', name: 'Antique Mauve Vy Dk', r: 113, g: 65, b: 73 },
  { code: '3803', name: 'Mauve Dark', r: 171, g: 51, b: 87 },
  { code: '3804', name: 'Cyclamen Pink Dark', r: 224, g: 40, b: 118 },
  { code: '3805', name: 'Cyclamen Pink', r: 243, g: 71, b: 139 },
  { code: '3806', name: 'Cyclamen Pink Light', r: 255, g: 140, b: 174 },
  { code: '3807', name: 'Cornflower Blue', r: 96, g: 103, b: 140 },
  { code: '3808', name: 'Turquoise Ult Vy Dk', r: 54, g: 105, b: 112 },
  { code: '3809', name: 'Turquoise Vy Dark', r: 63, g: 124, b: 133 },
  { code: '3810', name: 'Turquoise Dark', r: 72, g: 142, b: 154 },
  { code: '3811', name: 'Turquoise Very Light', r: 188, g: 227, b: 230 },
  { code: '3812', name: 'Sea Green Vy Dk', r: 47, g: 140, b: 132 },
  { code: '3813', name: 'Blue Green Lt', r: 178, g: 212, b: 189 },
  { code: '3814', name: 'Aquamarine', r: 80, g: 139, b: 125 },
  { code: '3815', name: 'Celadon Green Dk', r: 71, g: 119, b: 89 },
  { code: '3816', name: 'Celadon Green', r: 101, g: 165, b: 125 },
  { code: '3817', name: 'Celadon Green Lt', r: 153, g: 195, b: 170 },
  { code: '3818', name: 'Emerald Grn Ult V Dk', r: 17, g: 90, b: 59 },
  { code: '3819', name: 'Moss Green Lt', r: 224, g: 232, b: 104 },
  { code: '3820', name: 'Straw Dark', r: 223, g: 182, b: 95 },
  { code: '3821', name: 'Straw', r: 243, g: 206, b: 117 },
  { code: '3822', name: 'Straw Light', r: 246, g: 220, b: 152 },
  { code: '3823', name: 'Yellow Ultra Pale', r: 255, g: 253, b: 227 },
  { code: '3824', name: 'Apricot Light', r: 254, g: 205, b: 194 },
  { code: '3825', name: 'Pumpkin Pale', r: 253, g: 189, b: 150 },
  { code: '3826', name: 'Golden Brown', r: 173, g: 114, b: 57 },
  { code: '3827', name: 'Golden Brown Pale', r: 247, g: 187, b: 119 },
  { code: '3828', name: 'Hazelnut Brown', r: 183, g: 139, b: 97 },
  { code: '3829', name: 'Old Gold Vy Dark', r: 169, g: 130, b: 4 },
  { code: '3830', name: 'Terra Cotta', r: 185, g: 85, b: 68 },
  { code: '3831', name: 'Raspberry Dark', r: 179, g: 47, b: 72 },
  { code: '3832', name: 'Raspberry Medium', r: 219, g: 85, b: 110 },
  { code: '3833', name: 'Raspberry Light', r: 234, g: 134, b: 153 },
  { code: '3834', name: 'Grape Dark', r: 114, g: 55, b: 93 },
  { code: '3835', name: 'Grape Medium', r: 148, g: 96, b: 131 },
  { code: '3836', name: 'Grape Light', r: 186, g: 145, b: 170 },
  { code: '3837', name: 'Lavender Ultra Dark', r: 108, g: 58, b: 110 },
  { code: '3838', name: 'Lavender Blue Dark', r: 92, g: 114, b: 148 },
  { code: '3839', name: 'Lavender Blue Med', r: 123, g: 142, b: 171 },
  { code: '3840', name: 'Lavender Blue Light', r: 176, g: 192, b: 218 },
  { code: '3841', name: 'Baby Blue Pale', r: 205, g: 223, b: 237 },
  { code: '3842', name: 'Wedgewood Vry Dk', r: 50, g: 102, b: 124 },
  { code: '3843', name: 'Electric Blue', r: 20, g: 170, b: 208 },
  { code: '3844', name: 'Turquoise Bright Dark', r: 18, g: 174, b: 186 },
  { code: '3845', name: 'Turquoise Bright Med', r: 4, g: 196, b: 202 },
  { code: '3846', name: 'Turquoise Bright Light', r: 6, g: 227, b: 230 },
  { code: '3847', name: 'Teal Green Dark', r: 52, g: 125, b: 117 },
  { code: '3848', name: 'Teal Green Med', r: 85, g: 147, b: 146 },
  { code: '3849', name: 'Teal Green Light', r: 82, g: 179, b: 164 },
  { code: '3850', name: 'Green Bright Dk', r: 55, g: 132, b: 119 },
  { code: '3851', name: 'Green Bright Lt', r: 73, g: 179, b: 161 },
  { code: '3852', name: 'Straw Very Dark', r: 205, g: 157, b: 55 },
  { code: '3853', name: 'Autumn Gold Dk', r: 242, g: 151, b: 70 },
  { code: '3854', name: 'Autumn Gold Med', r: 242, g: 175, b: 104 },
  { code: '3855', name: 'Autumn Gold Lt', r: 250, g: 211, b: 150 },
  { code: '3856', name: 'Mahogany Ult Vy Lt', r: 255, g: 211, b: 181 },
  { code: '3857', name: 'Rosewood Dark', r: 104, g: 37, b: 26 },
  { code: '3858', name: 'Rosewood Med', r: 150, g: 74, b: 63 },
  { code: '3859', name: 'Rosewood Light', r: 186, g: 139, b: 124 },
  { code: '3860', name: 'Cocoa', r: 125, g: 93, b: 87 },
  { code: '3861', name: 'Cocoa Light', r: 166, g: 136, b: 129 },
  { code: '3862', name: 'Mocha Beige Dark', r: 138, g: 110, b: 78 },
  { code: '3863', name: 'Mocha Beige Med', r: 164, g: 131, b: 92 },
  { code: '3864', name: 'Mocha Beige Light', r: 203, g: 182, b: 156 },
  { code: '3865', name: 'Winter White', r: 249, g: 247, b: 241 },
  { code: '3866', name: 'Mocha Brn Ult Vy Lt', r: 250, g: 246, b: 240 },
];

// === Color matching using CIE Lab perceptual distance ===
// RGB->Lab conversion gives much better visual matches than raw RGB distance
function rgbToLab(r, g, b) {
  let R = r / 255, G = g / 255, B = b / 255;
  R = R > 0.04045 ? Math.pow((R + 0.055) / 1.055, 2.4) : R / 12.92;
  G = G > 0.04045 ? Math.pow((G + 0.055) / 1.055, 2.4) : G / 12.92;
  B = B > 0.04045 ? Math.pow((B + 0.055) / 1.055, 2.4) : B / 12.92;
  let X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  let Y = (R * 0.2126 + G * 0.7152 + B * 0.0722) / 1.0;
  let Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  X = X > 0.008856 ? Math.pow(X, 1/3) : (7.787 * X) + 16/116;
  Y = Y > 0.008856 ? Math.pow(Y, 1/3) : (7.787 * Y) + 16/116;
  Z = Z > 0.008856 ? Math.pow(Z, 1/3) : (7.787 * Z) + 16/116;
  return [(116 * Y) - 16, 500 * (X - Y), 200 * (Y - Z)];
}

// De-dupe by code — the curated list has a few accidental duplicates.
const DMC_UNIQUE = (() => {
  const seen = new Set();
  return DMC_COLORS.filter(c => {
    if (seen.has(c.code)) return false;
    seen.add(c.code);
    return true;
  });
})();

// Pre-compute Lab values for each DMC color
const DMC_LAB = DMC_UNIQUE.map(c => ({ ...c, lab: rgbToLab(c.r, c.g, c.b) }));

// Family-grouped, alphabetized-by-code list for the inventory picker.
const DMC_BY_FAMILY = (() => {
  const groups = {};
  for (const c of DMC_UNIQUE) {
    const fam = colorFamily(c);
    (groups[fam] ||= []).push(c);
  }
  // Within each family, sort by approximate brightness (light → dark) so swatches read like a gradient.
  for (const fam of Object.keys(groups)) {
    groups[fam].sort((a, b) => (b.r + b.g + b.b) - (a.r + a.g + a.b));
  }
  return FAMILY_ORDER
    .filter(f => groups[f] && groups[f].length)
    .map(f => ({ family: f, colors: groups[f] }));
})();

function findNearestDMC(r, g, b, palette = DMC_LAB) {
  const [L, a, bL] = rgbToLab(r, g, b);
  let best = palette[0];
  let bestDist = Infinity;
  for (const c of palette) {
    const dL = L - c.lab[0];
    const da = a - c.lab[1];
    const db = bL - c.lab[2];
    const d = dL*dL + da*da + db*db;
    if (d < bestDist) { bestDist = d; best = c; }
  }
  return best;
}

// === Symbol assignment for printable chart ===
// Numbers and letters only — easy to read, easy to write.
// Skip ambiguous chars: 0/O, 1/I/L, to avoid confusion at small print sizes.
const SYMBOL_POOL = [
  // Single digits first (most common colors get easiest labels)
  '2','3','4','5','6','7','8','9',
  // Then capital letters (skip I, O, L)
  'A','B','C','D','E','F','G','H','J','K','M','N','P','Q','R','S','T','U','V','W','X','Y','Z',
  // Then lowercase (skip i, o, l)
  'a','b','c','d','e','f','g','h','j','k','m','n','p','q','r','s','t','u','v','w','x','y','z',
  // Two-digit numbers if we run out (>57 colors, very rare)
  '10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30',
];

export default function DiamondPaintingConverter() {
  const [imageData, setImageData] = useState(null); // {dataUrl, width, height, name}
  // Canvas size in cm — matches how diamond painting kits are actually sold
  // (30x40, 40x50, etc.). Internal math runs in mm for exact grid counts:
  // 40cm @ 2.5mm = 160 cells exactly, no rounding error.
  const [canvasWidthCm, setCanvasWidthCm] = useState(40);
  const [canvasHeightCm, setCanvasHeightCm] = useState(30);
  const [drillSizeMm, setDrillSizeMm] = useState(2.5);
  const [maxColors, setMaxColors] = useState(30);
  const [drillShape, setDrillShape] = useState('round'); // 'round' | 'square'
  const [pattern, setPattern] = useState(null); // {grid, palette, gridW, gridH}
  const [processing, setProcessing] = useState(false);
  const [view, setView] = useState('color'); // 'color' | 'symbol' | 'side-by-side'
  const [zoom, setZoom] = useState(1);
  const [history, setHistory] = useState([]); // [{id, name, thumbDataUrl, createdAt, settings, gridW, gridH, paletteCount}]
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const [activeHistoryId, setActiveHistoryId] = useState(null);

  // Inventory of owned drills + toggle to restrict matching to those colors only.
  const [myDrills, setMyDrills] = useState(() => loadMyDrills());
  const [useMyDrillsOnly, setUseMyDrillsOnly] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [inventorySearch, setInventorySearch] = useState('');

  const toggleDrill = (code) => {
    setMyDrills(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      persistMyDrills(next);
      return next;
    });
  };
  const setFamilyDrills = (familyCodes, on) => {
    setMyDrills(prev => {
      const next = new Set(prev);
      for (const code of familyCodes) {
        if (on) next.add(code); else next.delete(code);
      }
      persistMyDrills(next);
      return next;
    });
  };
  const clearAllDrills = () => {
    if (!confirm('Clear your entire drill inventory?')) return;
    const next = new Set();
    persistMyDrills(next);
    setMyDrills(next);
  };
  const saveCurrentAsInventory = () => {
    if (!pattern) return;
    const next = new Set(pattern.palette.map(p => p.code));
    persistMyDrills(next);
    setMyDrills(next);
  };

  // Filtered family groups for the inventory modal (memoized — runs on every keystroke).
  const filteredFamilies = useMemo(() => {
    const q = inventorySearch.trim().toLowerCase();
    if (!q) return DMC_BY_FAMILY;
    return DMC_BY_FAMILY
      .map(({ family, colors }) => ({
        family,
        colors: colors.filter(c =>
          c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
        ),
      }))
      .filter(g => g.colors.length > 0);
  }, [inventorySearch]);

  const fileInputRef = useRef(null);
  const previewCanvasRef = useRef(null);
  const symbolCanvasRef = useRef(null);
  const broadcastRef = useRef(null);
  const firstHistoryLoadRef = useRef(true);

  // Load history (metadata only — no full images) and listen for cross-tab updates.
  const refreshHistory = useCallback(async () => {
    try {
      const all = await dbGetAll();
      const summary = all
        .map(({ imageDataUrl, pattern: _p, ...rest }) => rest)
        .sort((a, b) => b.createdAt - a.createdAt);
      setHistory(summary);
      setHistoryError(null);
      // Auto-open on the very first load if there are saved patterns. Don't fight the user
      // after that — refreshes on tab focus shouldn't reopen a panel they closed.
      if (firstHistoryLoadRef.current) {
        firstHistoryLoadRef.current = false;
        if (summary.length > 0) setHistoryOpen(true);
      }
    } catch (err) {
      console.error('Failed to load history', err);
      setHistoryError(err.message || 'Could not load history');
    }
  }, []);

  useEffect(() => {
    refreshHistory();
    if ('BroadcastChannel' in window) {
      const bc = new BroadcastChannel(HISTORY_CHANNEL);
      bc.onmessage = () => refreshHistory();
      broadcastRef.current = bc;
    }
    const onVis = () => { if (document.visibilityState === 'visible') refreshHistory(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      if (broadcastRef.current) broadcastRef.current.close();
    };
  }, [refreshHistory]);

  // Derived: grid dimensions in cells. Math runs in mm: cm * 10 / drillMm.
  // For standard kit sizes (30, 40, 50, 70 cm) at standard drills (2.5, 2.8, 3.0 mm)
  // this lands on exact integers; only odd combos round.
  const canvasWidthMm = canvasWidthCm * 10;
  const canvasHeightMm = canvasHeightCm * 10;
  const gridW = Math.max(1, Math.round(canvasWidthMm / drillSizeMm));
  const gridH = Math.max(1, Math.round(canvasHeightMm / drillSizeMm));
  const totalDrills = gridW * gridH;
  // Actual printed canvas size based on the rounded grid (what you'll really get).
  const actualWidthMm = gridW * drillSizeMm;
  const actualHeightMm = gridH * drillSizeMm;
  // Inches readout for reference (1 in = 2.54 cm exactly).
  const canvasWidthIn = canvasWidthCm / 2.54;
  const canvasHeightIn = canvasHeightCm / 2.54;

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        setImageData({ dataUrl: ev.target.result, width: img.width, height: img.height, name: file.name });
        setPattern(null);
        setActiveHistoryId(null);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  // Save current image+pattern to history. Compresses image first so phones don't blow past
  // IndexedDB quotas, and prunes oldest entries past HISTORY_LIMIT.
  const saveToHistory = useCallback(async (currentImage, currentPattern) => {
    if (!currentImage || !currentPattern) return;
    try {
      const [{ dataUrl: storedImage }, thumbDataUrl] = await Promise.all([
        compressForStorage(currentImage.dataUrl),
        makeThumbnail(currentImage.dataUrl),
      ]);
      const id = `pat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const niceName = currentImage.name
        ? currentImage.name.replace(/\.[^.]+$/, '')
        : `Pattern ${new Date().toLocaleDateString()}`;
      const record = {
        id,
        name: niceName,
        createdAt: Date.now(),
        thumbDataUrl,
        imageDataUrl: storedImage,
        sourceWidth: currentImage.width,
        sourceHeight: currentImage.height,
        gridW: currentPattern.gridW,
        gridH: currentPattern.gridH,
        paletteCount: currentPattern.palette.length,
        drillCount: currentPattern.grid.length,
        settings: {
          canvasWidthCm,
          canvasHeightCm,
          drillSizeMm,
          maxColors,
          drillShape,
        },
        pattern: {
          grid: currentPattern.grid,
          palette: currentPattern.palette,
          gridW: currentPattern.gridW,
          gridH: currentPattern.gridH,
        },
      };
      await dbPut(record);

      // Prune oldest beyond limit
      const all = await dbGetAll();
      if (all.length > HISTORY_LIMIT) {
        const sorted = all.sort((a, b) => a.createdAt - b.createdAt);
        const toDelete = sorted.slice(0, all.length - HISTORY_LIMIT);
        for (const old of toDelete) await dbDelete(old.id);
      }

      setActiveHistoryId(id);
      await refreshHistory();
      if (broadcastRef.current) broadcastRef.current.postMessage({ type: 'history-updated' });
    } catch (err) {
      console.error('Failed to save to history', err);
      setHistoryError('Could not save to history. Storage may be full.');
    }
  }, [canvasWidthCm, canvasHeightCm, drillSizeMm, maxColors, drillShape, refreshHistory]);

  // Restore: pull full record from DB and rehydrate state without re-running the matcher.
  const restoreFromHistory = async (id) => {
    try {
      const rec = await dbGet(id);
      if (!rec) return;
      setImageData({
        dataUrl: rec.imageDataUrl,
        width: rec.sourceWidth || 0,
        height: rec.sourceHeight || 0,
        name: rec.name,
      });
      if (rec.settings) {
        // Migrate older entries that stored inches.
        const s = rec.settings;
        const cmW = s.canvasWidthCm != null ? s.canvasWidthCm : (s.canvasWidthIn != null ? s.canvasWidthIn * 2.54 : 40);
        const cmH = s.canvasHeightCm != null ? s.canvasHeightCm : (s.canvasHeightIn != null ? s.canvasHeightIn * 2.54 : 30);
        setCanvasWidthCm(cmW);
        setCanvasHeightCm(cmH);
        setDrillSizeMm(s.drillSizeMm);
        setMaxColors(s.maxColors);
        setDrillShape(s.drillShape);
      }
      setPattern(rec.pattern);
      setActiveHistoryId(id);
      setHistoryOpen(false);
    } catch (err) {
      console.error('Failed to restore from history', err);
      setHistoryError('Could not load that pattern.');
    }
  };

  const deleteHistoryItem = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      await dbDelete(id);
      if (activeHistoryId === id) setActiveHistoryId(null);
      await refreshHistory();
      if (broadcastRef.current) broadcastRef.current.postMessage({ type: 'history-updated' });
    } catch (err) {
      console.error('Failed to delete', err);
    }
  };

  const clearAllHistory = async () => {
    if (!confirm('Delete every saved pattern? This cannot be undone.')) return;
    try {
      await dbClear();
      setActiveHistoryId(null);
      await refreshHistory();
      if (broadcastRef.current) broadcastRef.current.postMessage({ type: 'history-updated' });
    } catch (err) {
      console.error('Failed to clear history', err);
    }
  };

  const renameHistoryItem = async (id) => {
    try {
      const rec = await dbGet(id);
      if (!rec) return;
      const next = prompt('Rename this pattern:', rec.name || '');
      if (next == null) return;
      const trimmed = next.trim();
      if (!trimmed || trimmed === rec.name) return;
      rec.name = trimmed;
      await dbPut(rec);
      await refreshHistory();
      if (broadcastRef.current) broadcastRef.current.postMessage({ type: 'history-updated' });
    } catch (err) {
      console.error('Failed to rename', err);
    }
  };

  const generatePattern = useCallback(async () => {
    if (!imageData) return;
    if (useMyDrillsOnly && myDrills.size === 0) {
      alert('Add colors to your drill inventory first, then try again.');
      return;
    }
    setProcessing(true);
    // Yield to UI
    await new Promise(r => setTimeout(r, 50));

    const img = new Image();
    img.src = imageData.dataUrl;
    await new Promise(res => { img.onload = res; });

    // Step 1: downsample image to grid resolution with proper averaging
    const sampler = document.createElement('canvas');
    sampler.width = gridW;
    sampler.height = gridH;
    const sctx = sampler.getContext('2d');
    sctx.imageSmoothingEnabled = true;
    sctx.imageSmoothingQuality = 'high';

    // Maintain aspect ratio by cropping image to grid aspect
    const gridAspect = gridW / gridH;
    const imgAspect = img.width / img.height;
    let sx = 0, sy = 0, sw = img.width, sh = img.height;
    if (imgAspect > gridAspect) {
      sw = img.height * gridAspect;
      sx = (img.width - sw) / 2;
    } else {
      sh = img.width / gridAspect;
      sy = (img.height - sh) / 2;
    }
    sctx.drawImage(img, sx, sy, sw, sh, 0, 0, gridW, gridH);
    const imgData = sctx.getImageData(0, 0, gridW, gridH).data;

    let kept;
    if (useMyDrillsOnly) {
      // Strict inventory mode: palette = every DMC the user owns. No frequency-pruning;
      // each pixel matches its nearest owned color, and the final palette is whichever
      // owned colors actually appeared.
      kept = DMC_LAB.filter(c => myDrills.has(c.code));
    } else {
      // Step 2: collect all pixels with their initial DMC matches
      const initialMatches = new Map(); // code -> {color, count}
      for (let i = 0; i < gridW * gridH; i++) {
        const r = imgData[i*4], g = imgData[i*4+1], b = imgData[i*4+2];
        const m = findNearestDMC(r, g, b);
        const e = initialMatches.get(m.code);
        if (e) e.count++;
        else initialMatches.set(m.code, { color: m, count: 1 });
      }
      // Step 3: limit to top N colors. Sort by frequency; less-used colors get
      // remapped to the nearest kept DMC color in step 4.
      const sorted = [...initialMatches.values()].sort((a, b) => b.count - a.count);
      kept = sorted.slice(0, maxColors).map(e => e.color);
    }
    const keptLab = kept.map(c => c.lab ? c : { ...c, lab: rgbToLab(c.r, c.g, c.b) });

    // Step 4: rebuild grid using kept palette
    const grid = new Array(gridW * gridH);
    const finalCounts = new Map();
    for (let i = 0; i < gridW * gridH; i++) {
      const r = imgData[i*4], g = imgData[i*4+1], b = imgData[i*4+2];
      const m = findNearestDMC(r, g, b, keptLab);
      grid[i] = m.code;
      finalCounts.set(m.code, (finalCounts.get(m.code) || 0) + 1);
    }

    // Step 5: build palette with symbol assignments, sorted by count desc
    const palette = kept
      .filter(c => finalCounts.has(c.code))
      .sort((a, b) => (finalCounts.get(b.code) || 0) - (finalCounts.get(a.code) || 0))
      .map((c, i) => ({
        ...c,
        symbol: SYMBOL_POOL[i] || '?',
        count: finalCounts.get(c.code) || 0,
      }));

    const newPattern = { grid, palette, gridW, gridH, usedInventory: !!useMyDrillsOnly };
    setPattern(newPattern);
    setProcessing(false);

    // Auto-save to local history so user can re-print legend later without re-uploading.
    saveToHistory(imageData, newPattern);
  }, [imageData, gridW, gridH, maxColors, useMyDrillsOnly, myDrills, saveToHistory]);

  // Render color preview
  useEffect(() => {
    if (!pattern || !previewCanvasRef.current) return;
    const canvas = previewCanvasRef.current;
    const cellPx = 8; // base render size
    canvas.width = pattern.gridW * cellPx;
    canvas.height = pattern.gridH * cellPx;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const codeMap = new Map(pattern.palette.map(p => [p.code, p]));

    for (let y = 0; y < pattern.gridH; y++) {
      for (let x = 0; x < pattern.gridW; x++) {
        const code = pattern.grid[y * pattern.gridW + x];
        const c = codeMap.get(code);
        if (!c) continue;
        ctx.fillStyle = `rgb(${c.r},${c.g},${c.b})`;
        if (drillShape === 'round') {
          ctx.beginPath();
          ctx.arc(x * cellPx + cellPx/2, y * cellPx + cellPx/2, cellPx/2 - 0.3, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(x * cellPx + 0.3, y * cellPx + 0.3, cellPx - 0.6, cellPx - 0.6);
        }
      }
    }
  }, [pattern, drillShape]);

  // Render symbol/chart preview
  useEffect(() => {
    if (!pattern || !symbolCanvasRef.current) return;
    const canvas = symbolCanvasRef.current;
    const cellPx = 22;
    canvas.width = pattern.gridW * cellPx;
    canvas.height = pattern.gridH * cellPx;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const codeMap = new Map(pattern.palette.map(p => [p.code, p]));

    // Light color tint as background per cell so it's still readable but symbol shows
    for (let y = 0; y < pattern.gridH; y++) {
      for (let x = 0; x < pattern.gridW; x++) {
        const code = pattern.grid[y * pattern.gridW + x];
        const c = codeMap.get(code);
        if (!c) continue;
        // tinted background
        ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},0.35)`;
        ctx.fillRect(x * cellPx, y * cellPx, cellPx, cellPx);
      }
    }
    // symbols
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let y = 0; y < pattern.gridH; y++) {
      for (let x = 0; x < pattern.gridW; x++) {
        const code = pattern.grid[y * pattern.gridW + x];
        const c = codeMap.get(code);
        if (!c) continue;
        // Auto-shrink for 2-character labels so they fit
        const fontSize = c.symbol.length > 1 ? Math.floor(cellPx * 0.5) : Math.floor(cellPx * 0.7);
        ctx.font = `bold ${fontSize}px ui-monospace, "Courier New", monospace`;
        ctx.fillStyle = '#000';
        ctx.fillText(c.symbol, x * cellPx + cellPx/2, y * cellPx + cellPx/2 + 1);
      }
    }
  }, [pattern]);

  // === DMC Legend — opens a print-ready single-page sheet ===
  const downloadLegend = () => {
    if (!pattern) return;
    const w = window.open('', '_blank');
    if (!w) { alert('Allow popups to print the legend'); return; }

    // Inline SVG swatches: iOS Safari strips CSS background colors when printing,
    // even with print-color-adjust set. SVG fill attributes always print.
    const swatchSvg = (p) => {
      const stroke = (p.r + p.g + p.b) > 700 ? '#888' : 'none';
      return `<svg width="32" height="20" viewBox="0 0 32 20" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:middle"><rect width="32" height="20" fill="rgb(${p.r},${p.g},${p.b})" stroke="${stroke}" stroke-width="1"/></svg>`;
    };

    const paletteRows = pattern.palette.map(p => `
      <tr>
        <td class="sym">${p.symbol}</td>
        <td class="sw-cell">${swatchSvg(p)}</td>
        <td><b>DMC ${p.code}</b></td>
        <td>${p.name}</td>
        <td class="num">${p.count.toLocaleString()}</td>
      </tr>
    `).join('');

    w.document.write(`<!doctype html>
<html>
<head>
  <title>DMC Color Legend</title>
  <style>
    @page { size: letter; margin: 0.5in; }
    /* Force colors to print on iOS Safari, Chrome, Firefox. */
    html, body, * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    body { font-family: Calibri, Carlito, "Segoe UI", Helvetica, Arial, sans-serif; margin: 0; padding: 0; color: #1a1a1a; }
    h1 { font-size: 22pt; margin: 0 0 4pt; letter-spacing: -0.01em; }
    .meta { font-size: 10pt; color: #444; margin-bottom: 14pt; line-height: 1.6; }
    table { border-collapse: collapse; width: 100%; font-size: 10pt; }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; }
    th { text-align: left; padding: 5pt 6pt; border-bottom: 1.5px solid #1a1a1a; font-weight: bold; background: #fff; }
    td { padding: 5pt 6pt; border-bottom: 0.5px solid #ddd; vertical-align: middle; }
    td.sym { font-family: ui-monospace, "Courier New", monospace; font-size: 14pt; font-weight: bold; text-align: center; width: 38pt; }
    td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
    td.sw-cell { width: 40pt; line-height: 0; }
    td.sw-cell svg { width: 32pt; height: 20pt; }
  </style>
</head>
<body>
  <h1>DMC Color Legend</h1>
  <div class="meta">
    ${pattern.palette.length} colors &middot; ${pattern.grid.length.toLocaleString()} drills &middot; Canvas ${canvasWidthCm} &times; ${canvasHeightCm} cm (${canvasWidthIn.toFixed(2)}" &times; ${canvasHeightIn.toFixed(2)}") &middot; ${drillSizeMm.toFixed(2)}mm ${drillShape}
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:38pt;text-align:center">Symbol</th>
        <th style="width:40pt">Color</th>
        <th>DMC</th>
        <th>Name</th>
        <th class="num">Count</th>
      </tr>
    </thead>
    <tbody>${paletteRows}</tbody>
  </table>
</body>
</html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 500);
  };

  // === 300 DPI PNG of full canvas symbol chart for commercial print ===
  const exportPNG300DPI = () => {
    if (!pattern) return;
    const DPI = 300;
    const cellPx = Math.max(8, Math.round(drillSizeMm * DPI / 25.4));
    const w = pattern.gridW * cellPx;
    const h = pattern.gridH * cellPx;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    const codeMap = new Map(pattern.palette.map(p => [p.code, p]));

    // tinted color cells (no grid lines)
    for (let y = 0; y < pattern.gridH; y++) {
      for (let x = 0; x < pattern.gridW; x++) {
        const code = pattern.grid[y * pattern.gridW + x];
        const c = codeMap.get(code);
        if (!c) continue;
        ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},0.35)`;
        ctx.fillRect(x * cellPx, y * cellPx, cellPx, cellPx);
      }
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let y = 0; y < pattern.gridH; y++) {
      for (let x = 0; x < pattern.gridW; x++) {
        const code = pattern.grid[y * pattern.gridW + x];
        const c = codeMap.get(code);
        if (!c) continue;
        const fontSize = c.symbol.length > 1 ? Math.floor(cellPx * 0.45) : Math.floor(cellPx * 0.65);
        ctx.font = `bold ${fontSize}px "Courier New", Consolas, ui-monospace, monospace`;
        ctx.fillStyle = '#000';
        ctx.fillText(c.symbol, x * cellPx + cellPx / 2, y * cellPx + cellPx / 2);
      }
    }

    canvas.toBlob(blob => {
      if (!blob) { alert('PNG export failed (canvas too large?)'); return; }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `sparkle-pattern-${pattern.gridW}x${pattern.gridH}-300dpi.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/png');
  };

  // === SVG vector export at exact canvas dimensions ===
  const exportSVG = () => {
    if (!pattern) return;
    const codeMap = new Map(pattern.palette.map(p => [p.code, p]));
    const cellMm = drillSizeMm;
    const widthMm = pattern.gridW * cellMm;
    const heightMm = pattern.gridH * cellMm;

    let cells = '';
    let symbols = '';
    for (let y = 0; y < pattern.gridH; y++) {
      for (let x = 0; x < pattern.gridW; x++) {
        const code = pattern.grid[y * pattern.gridW + x];
        const c = codeMap.get(code);
        if (!c) continue;
        cells += `<rect x="${(x*cellMm).toFixed(3)}" y="${(y*cellMm).toFixed(3)}" width="${cellMm}" height="${cellMm}" fill="rgb(${c.r},${c.g},${c.b})" fill-opacity="0.35"/>`;
        const fs = c.symbol.length > 1 ? cellMm * 0.45 : cellMm * 0.62;
        symbols += `<text x="${(x*cellMm + cellMm/2).toFixed(3)}" y="${(y*cellMm + cellMm/2).toFixed(3)}" font-family="'Courier New', Consolas, monospace" font-size="${fs.toFixed(3)}" font-weight="bold" text-anchor="middle" dominant-baseline="central" fill="#000">${c.symbol}</text>`;
      }
    }

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${widthMm}mm" height="${heightMm}mm" viewBox="0 0 ${widthMm} ${heightMm}">
<rect width="${widthMm}" height="${heightMm}" fill="#ffffff"/>
${cells}
${symbols}
</svg>`;

    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sparkle-pattern-${pattern.gridW}x${pattern.gridH}.svg`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const printChart = () => {
    if (!pattern || !symbolCanvasRef.current || !previewCanvasRef.current) {
      alert('Please generate a pattern first.');
      return;
    }

    const colorUrl = previewCanvasRef.current.toDataURL('image/png');
    const masterCanvas = symbolCanvasRef.current;
    const masterCellPx = masterCanvas.width / pattern.gridW;

    // 1:1 print scale: each printed cell = drillSizeMm. Tile across US Letter pages.
    // Letter: 215.9mm x 279.4mm. Margins 10.16mm (0.4"). Header reserves 18mm.
    const PAGE_W_MM = 215.9;
    const PAGE_H_MM = 279.4;
    const MARGIN_MM = 10.16;
    const HEADER_MM = 18;
    const usableW = PAGE_W_MM - 2 * MARGIN_MM;
    const usableH = PAGE_H_MM - 2 * MARGIN_MM - HEADER_MM;
    const cellsPerPageW = Math.max(1, Math.floor(usableW / drillSizeMm));
    const cellsPerPageH = Math.max(1, Math.floor(usableH / drillSizeMm));
    const pagesX = Math.ceil(pattern.gridW / cellsPerPageW);
    const pagesY = Math.ceil(pattern.gridH / cellsPerPageH);

    let tilesHtml = '';
    for (let py = 0; py < pagesY; py++) {
      for (let px = 0; px < pagesX; px++) {
        const startX = px * cellsPerPageW;
        const startY = py * cellsPerPageH;
        const tW = Math.min(cellsPerPageW, pattern.gridW - startX);
        const tH = Math.min(cellsPerPageH, pattern.gridH - startY);

        const tileCanvas = document.createElement('canvas');
        tileCanvas.width = tW * masterCellPx;
        tileCanvas.height = tH * masterCellPx;
        const tctx = tileCanvas.getContext('2d');
        tctx.imageSmoothingEnabled = false;
        tctx.drawImage(
          masterCanvas,
          startX * masterCellPx, startY * masterCellPx, tW * masterCellPx, tH * masterCellPx,
          0, 0, tileCanvas.width, tileCanvas.height
        );

        const tileMmW = tW * drillSizeMm;
        const tileMmH = tH * drillSizeMm;
        const rowLabel = String.fromCharCode(65 + py);

        tilesHtml += `
          <div class="page tile-page">
            <div class="tile-header">
              <div><b>Section ${rowLabel}${px + 1}</b> &nbsp;·&nbsp; row ${py + 1} of ${pagesY}, col ${px + 1} of ${pagesX}</div>
              <div class="num">Cells: cols ${startX + 1}&ndash;${startX + tW}, rows ${startY + 1}&ndash;${startY + tH}</div>
              <div class="num">Print size: ${tileMmW.toFixed(1)}mm &times; ${tileMmH.toFixed(1)}mm (${(tileMmW/25.4).toFixed(2)}" &times; ${(tileMmH/25.4).toFixed(2)}")</div>
            </div>
            <img class="tile" src="${tileCanvas.toDataURL('image/png')}" style="width:${tileMmW}mm;height:${tileMmH}mm;" />
          </div>
        `;
      }
    }

    // Inline SVG swatch — iOS-safe (CSS backgrounds get stripped on print).
    const swatchSvg = (p) => {
      const stroke = (p.r + p.g + p.b) > 700 ? '#888' : 'none';
      return `<svg width="30" height="18" viewBox="0 0 30 18" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:middle"><rect width="30" height="18" fill="rgb(${p.r},${p.g},${p.b})" stroke="${stroke}" stroke-width="1"/></svg>`;
    };

    const paletteRows = pattern.palette.map(p => `
      <tr>
        <td class="sym">${p.symbol}</td>
        <td class="sw-cell">${swatchSvg(p)}</td>
        <td><b>DMC ${p.code}</b></td>
        <td>${p.name}</td>
        <td class="num">${p.count.toLocaleString()}</td>
        <td class="num">${(p.count / pattern.grid.length * 100).toFixed(1)}%</td>
      </tr>
    `).join('');

    const w = window.open('', '_blank');
    if (!w) { alert('Allow popups to print the chart'); return; }

    w.document.write(`
      <!doctype html>
      <html>
      <head>
        <title>Diamond Painting Pattern</title>
        <style>
          @page { size: letter; margin: ${MARGIN_MM}mm; }
          * { box-sizing: border-box; }
          /* Force colors to print on iOS Safari, Chrome, Firefox. */
          html, body, * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          body { font-family: Calibri, Carlito, "Segoe UI", Helvetica, Arial, sans-serif; margin: 0; color: #1a1a1a; }
          .page { page-break-after: always; }
          .page:last-child { page-break-after: auto; }
          h1 { font-size: 26pt; margin: 0 0 6pt; letter-spacing: -0.01em; }
          h2 { font-size: 14pt; margin: 14pt 0 8pt; border-bottom: 1.5px solid #1a1a1a; padding-bottom: 4pt; }
          .meta { font-size: 10pt; color: #444; margin-bottom: 14pt; line-height: 1.7; }
          .meta b { color: #1a1a1a; }
          .preview-wrap { text-align: center; margin: 22pt 0 14pt; }
          .preview { max-width: 6.5in; max-height: 7.5in; border: 1px solid #888; }
          table { border-collapse: collapse; width: 100%; font-size: 9.5pt; }
          thead { display: table-header-group; }
          tr { page-break-inside: avoid; }
          th { text-align: left; padding: 5pt 6pt; border-bottom: 1.5px solid #1a1a1a; font-weight: bold; background: #fff; }
          td { padding: 4pt 6pt; border-bottom: 0.5px solid #ddd; vertical-align: middle; }
          td.sym { font-family: ui-monospace, "Courier New", monospace; font-size: 14pt; font-weight: bold; text-align: center; width: 36pt; }
          td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
          td.sw-cell { width: 38pt; line-height: 0; }
          td.sw-cell svg { width: 30pt; height: 18pt; }
          .footer { font-size: 8pt; color: #888; text-align: center; margin-top: 16pt; font-style: italic; }
          .tile-page { padding: 0; }
          .tile-header { font-size: 9pt; color: #444; margin-bottom: 5mm; line-height: 1.55; border-bottom: 0.5pt solid #888; padding-bottom: 3mm; }
          .tile-header b { color: #1a1a1a; font-size: 11pt; }
          .tile { display: block; image-rendering: pixelated; image-rendering: crisp-edges; border: 0.25pt solid #444; }
          .num { font-variant-numeric: tabular-nums; }
        </style>
      </head>
      <body>
        <div class="page">
          <h1>Diamond Painting Pattern</h1>
          <div class="meta">
            <b>Canvas:</b> ${canvasWidthCm} &times; ${canvasHeightCm} cm &nbsp;(${canvasWidthIn.toFixed(2)}" &times; ${canvasHeightIn.toFixed(2)}")<br/>
            <b>Drill:</b> ${drillSizeMm.toFixed(2)}mm ${drillShape}<br/>
            <b>Grid:</b> ${pattern.gridW} &times; ${pattern.gridH} cells<br/>
            <b>Total drills:</b> ${pattern.grid.length.toLocaleString()}<br/>
            <b>Printed pattern size:</b> ${(pattern.gridW * drillSizeMm / 10).toFixed(2)} &times; ${(pattern.gridH * drillSizeMm / 10).toFixed(2)} cm<br/>
            <b>Colors:</b> ${pattern.palette.length}<br/>
            <b>Pattern sections:</b> ${pagesY} row${pagesY===1?'':'s'} &times; ${pagesX} col${pagesX===1?'':'s'} (${pagesY * pagesX} page${pagesY*pagesX===1?'':'s'} at 1:1 scale)
          </div>
          <div class="preview-wrap">
            <img class="preview" src="${colorUrl}" alt="Color preview" />
          </div>
          <div class="footer">Print at 100% scale (no fit-to-page). Section pages print at exact canvas dimensions for accurate drill placement.</div>
        </div>

        <div class="page">
          <h1 style="font-size:20pt">DMC Color Legend</h1>
          <div class="meta" style="margin-bottom:10pt">${pattern.palette.length} colors &middot; symbols match the section pages.</div>
          <table>
            <thead>
              <tr>
                <th style="width:36pt;text-align:center">Symbol</th>
                <th style="width:38pt">Color</th>
                <th>DMC</th>
                <th>Name</th>
                <th class="num">Count</th>
                <th class="num">%</th>
              </tr>
            </thead>
            <tbody>${paletteRows}</tbody>
          </table>
        </div>

        ${tilesHtml}
      </body>
      </html>
    `);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 600);
  };

  return (
    <div className="min-h-screen" style={{ background: '#f4f1ea', fontFamily: 'Calibri, Carlito, "Segoe UI", Helvetica, Arial, sans-serif', color: '#1a1a1a' }}>
      <style>{`
        @keyframes shimmer {
          0%,100% { transform: rotate(0deg) scale(1); opacity: 0.8; }
          50% { transform: rotate(180deg) scale(1.1); opacity: 1; }
        }
        .sparkle { animation: shimmer 4s ease-in-out infinite; }
        .btn-primary { background: #1a1a1a; color: #f4f1ea; transition: all 0.2s; }
        .btn-primary:hover:not(:disabled) { background: #333; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
        .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
        .btn-ghost { background: transparent; color: #1a1a1a; border: 1px solid #1a1a1a; transition: all 0.2s; }
        .btn-ghost:hover:not(:disabled) { background: #1a1a1a; color: #f4f1ea; }
        .panel { background: #fffdf8; border: 1px solid #d4cfc0; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
        input[type="number"], select { font-family: inherit; background: #fffdf8; border: 1px solid #c4bfb0; padding: 6px 8px; font-size: 14px; width: 100%; }
        input[type="number"]:focus, select:focus { outline: none; border-color: #1a1a1a; }
        input[type="range"] { width: 100%; accent-color: #1a1a1a; }
        .label-sm { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #666; font-family: inherit; font-weight: 600; }
        .num-display { font-variant-numeric: tabular-nums; font-family: ui-monospace, "Courier New", monospace; }
        .tab { padding: 8px 14px; border-bottom: 2px solid transparent; cursor: pointer; font-size: 13px; letter-spacing: 0.02em; transition: all 0.2s; }
        .tab.active { border-color: #1a1a1a; font-weight: bold; }
        .tab:hover { color: #000; }
      `}</style>

      {/* HEADER */}
      <header style={{ borderBottom: '1px solid #d4cfc0', background: '#fffdf8' }}>
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="sparkle" style={{ color: '#b8860b' }} size={28} />
            <div>
              <div style={{ fontSize: '22px', fontWeight: 'bold', letterSpacing: '-0.02em' }}>Sparkle Atelier</div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.15em', color: '#888' }}>Diamond Painting Pattern Studio</div>
            </div>
          </div>
          <div style={{ fontSize: '11px', color: '#888', textAlign: 'right' }}>
            DMC color matching · 454 colors<br />
            Made for makers
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT — Controls */}
        <aside className="lg:col-span-3 space-y-5">
          <div className="panel p-5">
            <div className="flex items-center gap-2 mb-3">
              <ImageIcon size={16} />
              <span className="label-sm">Source Image</span>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} hidden />
            <button className="btn-primary w-full py-3 px-4 flex items-center justify-center gap-2 text-sm font-semibold" onClick={() => fileInputRef.current?.click()}>
              <Upload size={16} />
              {imageData ? 'Replace image' : 'Upload image'}
            </button>
            {imageData && (
              <div className="mt-3 text-xs num-display" style={{ color: '#666' }}>
                {imageData.width} × {imageData.height} px
              </div>
            )}
            {imageData && (
              <img src={imageData.dataUrl} alt="" style={{ marginTop: '12px', width: '100%', maxHeight: '180px', objectFit: 'contain', background: '#f4f1ea', border: '1px solid #d4cfc0' }} />
            )}
          </div>

          {/* HISTORY PANEL — auto-saves every generation, restorable across tabs/sessions */}
          <div className="panel p-5">
            <div
              className="flex items-center justify-between"
              style={{ cursor: 'pointer', userSelect: 'none' }}
              onClick={() => setHistoryOpen(o => !o)}
            >
              <div className="flex items-center gap-2">
                <History size={16} />
                <span className="label-sm">History</span>
                {history.length > 0 && (
                  <span className="num-display" style={{ fontSize: '11px', color: '#888', fontWeight: 'bold' }}>
                    {history.length}
                  </span>
                )}
              </div>
              {historyOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </div>

            {historyOpen && (
              <div className="mt-4">
                {historyError && (
                  <div style={{ padding: '8px 10px', background: '#fff4e0', borderLeft: '3px solid #d97706', fontSize: '11px', marginBottom: '10px', color: '#7c2d12' }}>
                    {historyError}
                  </div>
                )}
                {history.length === 0 ? (
                  <p style={{ fontSize: '12px', color: '#999', fontStyle: 'italic', lineHeight: '1.5' }}>
                    Patterns are saved here automatically each time you generate. Open this page in a new tab anytime to re-print a saved legend.
                  </p>
                ) : (
                  <>
                    <div style={{ maxHeight: '340px', overflowY: 'auto', margin: '-4px', padding: '4px' }}>
                      {history.map(h => {
                        const active = activeHistoryId === h.id;
                        return (
                          <div
                            key={h.id}
                            onClick={() => restoreFromHistory(h.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              padding: '8px',
                              marginBottom: '4px',
                              background: active ? '#f4f1ea' : 'transparent',
                              border: active ? '1px solid #b8860b' : '1px solid transparent',
                              cursor: 'pointer',
                              transition: 'background 0.15s',
                            }}
                            onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#faf8f1'; }}
                            onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                            title="Click to restore"
                          >
                            <img
                              src={h.thumbDataUrl}
                              alt=""
                              style={{ width: '44px', height: '44px', objectFit: 'cover', flexShrink: 0, border: '1px solid #d4cfc0', background: '#fff' }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 'bold', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {h.name}
                              </div>
                              <div className="num-display" style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>
                                {h.gridW}×{h.gridH} · {h.paletteCount} colors
                              </div>
                              <div style={{ fontSize: '10px', color: '#aaa', marginTop: '1px' }}>
                                {formatHistoryDate(h.createdAt)}
                              </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <button
                                onClick={(e) => { e.stopPropagation(); renameHistoryItem(h.id); }}
                                title="Rename"
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '3px', color: '#888', lineHeight: 0 }}
                              >
                                <RotateCcw size={12} />
                              </button>
                              <button
                                onClick={(e) => deleteHistoryItem(h.id, e)}
                                title="Delete"
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '3px', color: '#888', lineHeight: 0 }}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <button
                      onClick={clearAllHistory}
                      style={{ marginTop: '10px', background: 'transparent', border: 'none', color: '#888', fontSize: '11px', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
                    >
                      Clear all history
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="panel p-5">
            <div className="flex items-center gap-2 mb-4">
              <Settings size={16} />
              <span className="label-sm">Canvas Size</span>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="label-sm block mb-1">Width (cm)</label>
                <input type="number" min="5" max="150" step="0.5" value={canvasWidthCm} onChange={e => setCanvasWidthCm(parseFloat(e.target.value) || 0)} />
              </div>
              <div>
                <label className="label-sm block mb-1">Height (cm)</label>
                <input type="number" min="5" max="150" step="0.5" value={canvasHeightCm} onChange={e => setCanvasHeightCm(parseFloat(e.target.value) || 0)} />
              </div>
            </div>
            <div className="mb-3">
              <label className="label-sm block mb-1">Common kit sizes</label>
              <div className="grid grid-cols-3 gap-1.5" style={{ fontSize: '10.5px' }}>
                {[
                  [20, 30], [30, 40], [30, 30],
                  [40, 50], [40, 40], [40, 30],
                  [50, 70], [50, 50], [60, 80],
                ].map(([w, h]) => (
                  <button
                    key={`${w}x${h}`}
                    className={`py-1.5 px-1 ${(canvasWidthCm === w && canvasHeightCm === h) ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ fontWeight: 600 }}
                    onClick={() => { setCanvasWidthCm(w); setCanvasHeightCm(h); }}
                  >
                    {w}×{h}
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-3">
              <label className="label-sm block mb-1">Drill size (mm)</label>
              <select value={drillSizeMm} onChange={e => setDrillSizeMm(parseFloat(e.target.value))}>
                <option value="2.5">2.5 mm — standard (tightest)</option>
                <option value="2.8">2.8 mm — common</option>
                <option value="3.0">3.0 mm — large</option>
                <option value="2.0">2.0 mm — micro / mini</option>
              </select>
            </div>
            <div className="mb-3">
              <label className="label-sm block mb-1">Drill shape</label>
              <div className="flex gap-2">
                <button className={`flex-1 py-2 text-xs font-semibold ${drillShape === 'round' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setDrillShape('round')}>Round</button>
                <button className={`flex-1 py-2 text-xs font-semibold ${drillShape === 'square' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setDrillShape('square')}>Square</button>
              </div>
            </div>
            <div style={{ background: '#f4f1ea', padding: '10px 12px', borderLeft: '3px solid #b8860b', fontSize: '12px', marginTop: '12px' }}>
              <div style={{ fontWeight: 'bold' }}>Grid: <span className="num-display">{gridW} × {gridH}</span> drills</div>
              <div style={{ color: '#666', marginTop: '2px' }}>
                <span className="num-display">{totalDrills.toLocaleString()}</span> total
              </div>
              <div style={{ color: '#888', marginTop: '4px', fontSize: '11px' }}>
                Printed size: <span className="num-display">{(actualWidthMm/10).toFixed(1)} × {(actualHeightMm/10).toFixed(1)} cm</span>
                {' '}<span style={{ color: '#aaa' }}>({canvasWidthIn.toFixed(2)}″ × {canvasHeightIn.toFixed(2)}″)</span>
              </div>
            </div>
          </div>

          <div className="panel p-5">
            <div className="flex items-center gap-2 mb-3">
              <Palette size={16} />
              <span className="label-sm">Color Limit</span>
            </div>

            {/* Inventory mode toggle */}
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px', background: useMyDrillsOnly ? '#fff8e6' : '#faf8f1', border: `1px solid ${useMyDrillsOnly ? '#b8860b' : '#d4cfc0'}`, cursor: 'pointer', marginBottom: '12px' }}>
              <input
                type="checkbox"
                checked={useMyDrillsOnly}
                onChange={e => setUseMyDrillsOnly(e.target.checked)}
                style={{ marginTop: '2px', flexShrink: 0 }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '12px', fontWeight: 700 }}>Use my drills only</div>
                <div style={{ fontSize: '11px', color: '#666', marginTop: '2px', lineHeight: 1.4 }}>
                  Match the pattern using just the DMC colors you already own.
                </div>
              </div>
            </label>

            {useMyDrillsOnly ? (
              <>
                <div style={{ fontSize: '12px', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span><Package size={12} style={{ display: 'inline', marginRight: 4 }} /><b className="num-display">{myDrills.size}</b> drill{myDrills.size === 1 ? '' : 's'} owned</span>
                </div>
                <button
                  className="btn-ghost w-full py-2 text-xs font-semibold flex items-center justify-center gap-2"
                  onClick={() => setInventoryOpen(true)}
                >
                  <Settings size={12} /> Manage my drills
                </button>
                {myDrills.size === 0 && (
                  <p style={{ fontSize: '11px', color: '#b45309', marginTop: '8px', lineHeight: '1.4' }}>
                    Add at least one color before generating.
                  </p>
                )}
                {pattern && (
                  <button
                    className="w-full py-1 text-xs"
                    onClick={saveCurrentAsInventory}
                    style={{ background: 'transparent', border: 'none', color: '#888', textDecoration: 'underline', cursor: 'pointer', marginTop: '8px' }}
                  >
                    Save this pattern's {pattern.palette.length} colors as my inventory
                  </button>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-2">
                  <input type="range" min="5" max="80" value={maxColors} onChange={e => setMaxColors(parseInt(e.target.value))} />
                  <span className="num-display font-bold" style={{ minWidth: '30px', textAlign: 'right' }}>{maxColors}</span>
                </div>
                <p style={{ fontSize: '11px', color: '#666', lineHeight: '1.4' }}>Fewer colors = simpler kit. More colors = better detail. 25–40 is typical.</p>
                {myDrills.size > 0 && (
                  <button
                    className="w-full py-1 text-xs"
                    onClick={() => setInventoryOpen(true)}
                    style={{ background: 'transparent', border: 'none', color: '#888', textDecoration: 'underline', cursor: 'pointer', marginTop: '8px' }}
                  >
                    My inventory: {myDrills.size} drills
                  </button>
                )}
              </>
            )}
          </div>

          <button
            className="btn-primary w-full py-4 px-4 flex items-center justify-center gap-2 font-bold text-sm"
            onClick={generatePattern}
            disabled={!imageData || processing}
            style={{ letterSpacing: '0.05em' }}
          >
            {processing ? <><Loader2 className="animate-spin" size={16} /> PROCESSING…</> : <><Sparkles size={16} /> GENERATE PATTERN</>}
          </button>
        </aside>

        {/* CENTER — Preview */}
        <section className="lg:col-span-6">
          <div className="panel" style={{ minHeight: '500px' }}>
            {!pattern && !processing && (
              <div className="flex flex-col items-center justify-center h-full py-20" style={{ color: '#999' }}>
                <Grid3x3 size={56} strokeWidth={1} />
                <p className="mt-4 text-sm" style={{ fontStyle: 'italic' }}>
                  {imageData ? 'Press "Generate Pattern" to begin' : 'Upload an image to start'}
                </p>
              </div>
            )}

            {processing && (
              <div className="flex flex-col items-center justify-center h-full py-20">
                <Loader2 className="animate-spin" size={48} style={{ color: '#b8860b' }} />
                <p className="mt-4 text-sm" style={{ color: '#666' }}>Matching colors to DMC palette…</p>
              </div>
            )}

            {pattern && !processing && (
              <>
                <div style={{ borderBottom: '1px solid #d4cfc0', display: 'flex', padding: '0 16px' }}>
                  <div className={`tab ${view === 'color' ? 'active' : ''}`} onClick={() => setView('color')}>Color preview</div>
                  <div className={`tab ${view === 'symbol' ? 'active' : ''}`} onClick={() => setView('symbol')}>Symbol chart</div>
                  <div className={`tab ${view === 'side' ? 'active' : ''}`} onClick={() => setView('side')}>Side by side</div>
                </div>

                <div className="p-4">
                  <div className="flex items-center justify-between mb-3 text-xs" style={{ color: '#666' }}>
                    <div className="num-display">{pattern.gridW} × {pattern.gridH} grid · {pattern.grid.length.toLocaleString()} drills · {pattern.palette.length} colors</div>
                    <div className="flex items-center gap-2">
                      <span className="label-sm">Zoom</span>
                      <input type="range" min="0.3" max="3" step="0.1" value={zoom} onChange={e => setZoom(parseFloat(e.target.value))} style={{ width: '100px' }} />
                      <span className="num-display" style={{ minWidth: '36px' }}>{zoom.toFixed(1)}×</span>
                    </div>
                  </div>

                  <div style={{ overflow: 'auto', maxHeight: '70vh', background: '#f4f1ea', padding: '12px', border: '1px solid #d4cfc0' }}>
                    <div style={{
                      display: view === 'side' ? 'grid' : 'block',
                      gridTemplateColumns: view === 'side' ? '1fr 1fr' : undefined,
                      gap: view === 'side' ? '12px' : 0,
                    }}>
                      <div style={{ display: (view === 'color' || view === 'side') ? 'block' : 'none' }}>
                        {view === 'side' && <div className="label-sm mb-2">Color</div>}
                        <canvas
                          ref={previewCanvasRef}
                          style={{
                            display: 'block',
                            imageRendering: 'auto',
                            width: view === 'side' ? '100%' : `${pattern.gridW * 8 * zoom}px`,
                            height: view === 'side' ? 'auto' : `${pattern.gridH * 8 * zoom}px`,
                          }}
                        />
                      </div>
                      <div style={{ display: (view === 'symbol' || view === 'side') ? 'block' : 'none' }}>
                        {view === 'side' && <div className="label-sm mb-2">Symbols</div>}
                        <canvas
                          ref={symbolCanvasRef}
                          style={{
                            display: 'block',
                            imageRendering: 'pixelated',
                            width: view === 'side' ? '100%' : `${pattern.gridW * 22 * zoom * 0.4}px`,
                            height: view === 'side' ? 'auto' : `${pattern.gridH * 22 * zoom * 0.4}px`,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 space-y-4">
                    <div>
                      <div className="label-sm mb-2">Print at home</div>
                      <div className="grid grid-cols-2 gap-2">
                        <button className="btn-ghost py-2 text-xs flex items-center justify-center gap-2" onClick={downloadLegend}>
                          <Printer size={14} /> DMC Legend
                        </button>
                        <button className="btn-primary py-2 text-xs flex items-center justify-center gap-2" onClick={printChart}>
                          <Printer size={14} /> Full Pattern PDF
                        </button>
                      </div>
                    </div>

                    <div>
                      <div className="label-sm mb-2">For commercial print shop</div>
                      <div className="grid grid-cols-2 gap-2">
                        <button className="btn-ghost py-2 text-xs flex items-center justify-center gap-2" onClick={exportPNG300DPI}>
                          <Download size={14} /> PNG · 300 DPI
                        </button>
                        <button className="btn-ghost py-2 text-xs flex items-center justify-center gap-2" onClick={exportSVG}>
                          <Download size={14} /> SVG · Vector
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>

        {/* RIGHT — Palette */}
        <aside className="lg:col-span-3">
          <div className="panel p-5" style={{ position: 'sticky', top: '20px' }}>
            <div className="flex items-center gap-2 mb-4">
              <Palette size={16} />
              <span className="label-sm">DMC Palette</span>
            </div>
            {!pattern ? (
              <p style={{ fontSize: '12px', color: '#999', fontStyle: 'italic' }}>Generate a pattern to see the color list.</p>
            ) : (
              <>
                {pattern.usedInventory && (
                  <div style={{ fontSize: '11px', padding: '8px 10px', background: '#fff8e6', border: '1px solid #b8860b', marginBottom: '10px', lineHeight: 1.4 }}>
                    <b>Inventory mode</b> · matched from your owned drills
                  </div>
                )}
                <div style={{ maxHeight: '70vh', overflowY: 'auto', margin: '-4px', padding: '4px' }}>
                  {pattern.palette.map((p, i) => {
                    const owned = myDrills.has(p.code);
                    return (
                      <div key={p.code + i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 6px', borderBottom: '1px solid #ece8dc', fontSize: '12px' }}>
                        <span className="num-display" style={{ width: '20px', fontWeight: 'bold', textAlign: 'center', fontSize: '13px' }}>{p.symbol}</span>
                        <div style={{ width: '24px', height: '24px', background: `rgb(${p.r},${p.g},${p.b})`, border: '1px solid rgba(0,0,0,0.2)', flexShrink: 0, position: 'relative' }}>
                          {owned && (
                            <div title="In your inventory" style={{ position: 'absolute', top: '-4px', right: '-4px', width: '12px', height: '12px', background: '#16a34a', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                              <Check size={8} strokeWidth={4} />
                            </div>
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 'bold' }}>DMC {p.code}</div>
                          <div style={{ color: '#888', fontSize: '10px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                        </div>
                        <div className="num-display" style={{ fontSize: '10px', color: '#666', textAlign: 'right' }}>
                          <div>{p.count.toLocaleString()}</div>
                          <div>{(p.count / pattern.grid.length * 100).toFixed(1)}%</div>
                        </div>
                        <a
                          href={aliExpressUrl(p.code)}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`Search AliExpress for DMC ${p.code} drills`}
                          style={{ color: '#888', padding: '2px', display: 'flex', alignItems: 'center', textDecoration: 'none' }}
                          onMouseEnter={e => e.currentTarget.style.color = '#b8860b'}
                          onMouseLeave={e => e.currentTarget.style.color = '#888'}
                        >
                          <ShoppingCart size={13} />
                        </a>
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #ece8dc', fontSize: '10px', color: '#888', lineHeight: 1.5 }}>
                  <ShoppingCart size={10} style={{ display: 'inline', marginRight: 3, verticalAlign: '-1px' }} />
                  Click cart icons to search AliExpress for cheap drill bags. Etsy/Amazon also stock DMC-coded drills.
                </div>
              </>
            )}
          </div>
        </aside>
      </main>

      {/* INVENTORY MODAL — pick which DMC drills you own */}
      {inventoryOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(26, 26, 26, 0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setInventoryOpen(false); }}
        >
          <div style={{
            background: '#fffdf8', width: '100%', maxWidth: '720px', maxHeight: '90vh',
            display: 'flex', flexDirection: 'column',
            border: '1px solid #d4cfc0', boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          }}>
            {/* Header */}
            <div style={{ padding: '18px 20px', borderBottom: '1px solid #d4cfc0', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Package size={20} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '18px', fontWeight: 'bold' }}>My drill inventory</div>
                <div style={{ fontSize: '11px', color: '#666' }}>
                  <b className="num-display">{myDrills.size}</b> of <b className="num-display">{DMC_UNIQUE.length}</b> DMC colors selected
                </div>
              </div>
              <button
                onClick={() => setInventoryOpen(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#666', padding: '4px' }}
                title="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* Search */}
            <div style={{ padding: '12px 20px', borderBottom: '1px solid #ece8dc', background: '#faf8f1' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#999' }} />
                <input
                  type="text"
                  placeholder="Search by DMC code or color name…"
                  value={inventorySearch}
                  onChange={e => setInventorySearch(e.target.value)}
                  style={{ width: '100%', padding: '8px 8px 8px 32px', fontSize: '13px' }}
                  autoFocus
                />
              </div>
            </div>

            {/* Body — scrollable family-grouped list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
              {filteredFamilies.length === 0 ? (
                <p style={{ padding: '20px', textAlign: 'center', color: '#999', fontStyle: 'italic' }}>No matches.</p>
              ) : filteredFamilies.map(({ family, colors }) => {
                const codes = colors.map(c => c.code);
                const ownedInFamily = codes.filter(code => myDrills.has(code)).length;
                const allOwned = ownedInFamily === codes.length;
                return (
                  <div key={family}>
                    <div style={{
                      position: 'sticky', top: 0, zIndex: 1,
                      background: '#f4f1ea', padding: '8px 20px',
                      borderTop: '1px solid #d4cfc0', borderBottom: '1px solid #d4cfc0',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.08em',
                    }}>
                      <span>{family} <span style={{ color: '#888', fontWeight: 'normal' }}>· {ownedInFamily}/{codes.length}</span></span>
                      <button
                        onClick={() => setFamilyDrills(codes, !allOwned)}
                        style={{ background: 'transparent', border: 'none', color: '#b8860b', fontSize: '11px', cursor: 'pointer', textDecoration: 'underline', fontWeight: 'normal', textTransform: 'none', letterSpacing: 0 }}
                      >
                        {allOwned ? 'Deselect all' : 'Select all'}
                      </button>
                    </div>
                    <div style={{ padding: '4px 8px' }}>
                      {colors.map(c => {
                        const owned = myDrills.has(c.code);
                        return (
                          <label
                            key={c.code}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '10px',
                              padding: '7px 12px', cursor: 'pointer',
                              background: owned ? '#fff8e6' : 'transparent',
                              borderRadius: '2px',
                              fontSize: '12px',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={owned}
                              onChange={() => toggleDrill(c.code)}
                              style={{ flexShrink: 0 }}
                            />
                            <div style={{
                              width: '28px', height: '20px',
                              background: `rgb(${c.r},${c.g},${c.b})`,
                              border: '1px solid rgba(0,0,0,0.15)',
                              flexShrink: 0,
                            }} />
                            <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                              <span style={{ fontWeight: 'bold', minWidth: '52px' }}>DMC {c.code}</span>
                              <span style={{ color: '#666', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                            </div>
                            <a
                              href={aliExpressUrl(c.code)}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              title={`Search AliExpress for DMC ${c.code}`}
                              style={{ color: '#888', padding: '2px', display: 'flex' }}
                            >
                              <ShoppingCart size={13} />
                            </a>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 20px', borderTop: '1px solid #d4cfc0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#faf8f1' }}>
              <button
                onClick={clearAllDrills}
                style={{ background: 'transparent', border: 'none', color: '#888', fontSize: '12px', textDecoration: 'underline', cursor: 'pointer' }}
                disabled={myDrills.size === 0}
              >
                Clear all
              </button>
              <button
                className="btn-primary py-2 px-5 text-sm font-semibold"
                onClick={() => setInventoryOpen(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      <footer style={{ borderTop: '1px solid #d4cfc0', marginTop: '40px', padding: '20px', textAlign: 'center', fontSize: '11px', color: '#888' }}>
        Built with care for makers · Patterns scale exactly to drill size · Print at 100% (no scaling) for perfect fit
      </footer>
    </div>
  );
}
