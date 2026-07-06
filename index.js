require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const prisma = require('./prisma');

const PORT = process.env.PORT || 4000;
const BASE_URL =
  process.env.BASE_URL ||
  process.env.RENDER_EXTERNAL_URL ||
  `http://localhost:${PORT}`;
const ROOT_DIR = path.join(__dirname, '..');

function parseJsonField(value, fallback = []) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    try {
      return JSON.parse(value);
    } catch {
      return value.split(',').map(v => v.trim()).filter(Boolean);
    }
  }
  return fallback;
}

function serializeJsonField(value) {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const UPLOAD_DIR = path.join(ROOT_DIR, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use('/uploads', express.static(UPLOAD_DIR));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const safe = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
    cb(null, safe);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  },
});

const ADMIN_KEY = process.env.ADMIN_API_KEY || 'changeme';

function requireApiKey(req, res, next) {
  const key = req.header('x-api-key') || req.query.api_key;
  if (!key || key !== ADMIN_KEY) return res.status(401).json({ message: 'Unauthorized' });
  next();
}

function mapListing(l) {
  return {
    id: l.id,
    title: l.title,
    type: l.type,
    price: l.price,
    size: l.size,
    unit: l.unit,
    region: l.region,
    district: l.district,
    ward: l.ward,
    village: l.village,
    lat: l.lat,
    lon: l.lon,
    road: l.road,
    roadcond: l.roadcond,
    deed: l.deed,
    topo: l.topo,
    soil: l.soil,
    utilities: parseJsonField(l.utilities),
    amenities: l.amenities,
    desc: l.desc,
    contact: {
      name: l.contactName,
      phone: l.contactPhone,
      preferred: l.contactPreferred,
      email: l.contactEmail,
      role: l.contactRole,
      notes: l.contactNotes,
    },
    images: parseJsonField(l.images),
    featured: l.featured,
    color: l.color,
    createdAt: l.createdAt,
  };
}

app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const count = await prisma.listing.count();
    res.json({ ok: true, listings: count });
  } catch (err) {
    res.status(503).json({ ok: false, message: 'Database unavailable' });
  }
});

app.get('/api/listings', async (req, res) => {
  try {
    const { region, type, maxPrice, limit } = req.query;
    const where = {};
    if (region) where.region = region;
    if (type) where.type = type;
    if (maxPrice) where.price = { lte: parseInt(maxPrice, 10) };

    const items = await prisma.listing.findMany({
      where,
      take: Math.min(parseInt(limit || '100', 10), 200),
      orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
    });
    res.json({ listings: items.map(mapListing) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/listings/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ message: 'Invalid id' });

    const item = await prisma.listing.findUnique({ where: { id } });
    if (!item) return res.status(404).json({ message: 'Not found' });
    res.json(mapListing(item));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/search', async (req, res) => {
  try {
    const { q, region, type, maxPrice, page = 1, perPage = 12 } = req.query;
    const where = {};
    if (region) where.region = region;
    if (type) where.type = type;
    if (maxPrice) where.price = { lte: parseInt(maxPrice, 10) };
    if (q) {
      where.OR = [
        { title: { contains: q } },
        { desc: { contains: q } },
        { district: { contains: q } },
        { region: { contains: q } },
      ];
    }

    const take = Math.min(parseInt(perPage, 10) || 12, 100);
    const skip = (Math.max(parseInt(page, 10) || 1, 1) - 1) * take;
    const [items, total] = await Promise.all([
      prisma.listing.findMany({ where, take, skip, orderBy: { createdAt: 'desc' } }),
      prisma.listing.count({ where }),
    ]);
    res.json({
      listings: items.map(mapListing),
      total,
      page: parseInt(page, 10) || 1,
      perPage: take,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/listings', async (req, res) => {
  try {
    const body = req.body;
    if (!body.title || !body.type || !body.price) {
      return res.status(400).json({ message: 'Title, type, and price are required' });
    }

    const created = await prisma.listing.create({
      data: {
        title: body.title,
        type: body.type,
        price: parseInt(body.price, 10) || 0,
        size: body.size != null ? parseFloat(body.size) : null,
        unit: body.unit || null,
        region: body.region || null,
        district: body.district || null,
        ward: body.ward || null,
        village: body.village || null,
        lat: body.lat || null,
        lon: body.lon || null,
        road: body.road || null,
        roadcond: body.roadcond || null,
        deed: body.deed || null,
        topo: body.topo || null,
        soil: body.soil || null,
        utilities: serializeJsonField(body.utilities),
        amenities: body.amenities || null,
        desc: body.desc || null,
        contactName: body.contact?.name || null,
        contactPhone: body.contact?.phone || null,
        contactPreferred: body.contact?.preferred || null,
        contactEmail: body.contact?.email || null,
        contactRole: body.contact?.role || null,
        contactNotes: body.contact?.notes || null,
        images: serializeJsonField(body.images),
        featured: Boolean(body.featured),
        color: body.color || null,
      },
    });
    res.status(201).json(mapListing(created));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/listings/:id', requireApiKey, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const payload = { ...req.body };
    const data = {
      ...payload,
      utilities: payload.utilities !== undefined ? serializeJsonField(payload.utilities) : undefined,
      images: payload.images !== undefined ? serializeJsonField(payload.images) : undefined,
      contactName: payload.contact?.name ?? payload.contactName,
      contactPhone: payload.contact?.phone ?? payload.contactPhone,
      contactPreferred: payload.contact?.preferred ?? payload.contactPreferred,
      contactEmail: payload.contact?.email ?? payload.contactEmail,
      contactRole: payload.contact?.role ?? payload.contactRole,
      contactNotes: payload.contact?.notes ?? payload.contactNotes,
    };
    delete data.contact;

    const updated = await prisma.listing.update({ where: { id }, data });
    res.json(mapListing(updated));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.delete('/api/listings/:id', requireApiKey, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await prisma.listing.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/upload', (req, res) => {
  upload.array('images', 10)(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || 'Upload failed' });
    }
    try {
      const files = req.files || [];
      const urls = files.map(f => `${BASE_URL}/uploads/${encodeURIComponent(path.basename(f.filename))}`);
      res.json({ urls });
    } catch (uploadErr) {
      console.error(uploadErr);
      res.status(500).json({ message: 'Upload failed' });
    }
  });
});

const frontendPath = path.join(ROOT_DIR, 'landvault.html');
app.get('/', (req, res) => {
  if (fs.existsSync(frontendPath)) {
    return res.sendFile(frontendPath);
  }
  res.json({
    name: 'LandVault API',
    health: '/api/health',
    listings: '/api/listings',
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: err.message || 'Server error' });
});

async function start() {
  try {
    await prisma.$connect();
    const count = await prisma.listing.count();
    console.log(`Database connected (${count} listings)`);
  } catch (err) {
    console.error('Database connection failed:', err.message);
    console.error('Run: npx prisma migrate deploy && npm run seed');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`LandVault API listening on port ${PORT}`);
    console.log(`Public URL: ${BASE_URL}`);
    console.log(`Frontend: ${BASE_URL}/`);
    console.log(`API base: ${BASE_URL}/api`);
  });
}

start();
