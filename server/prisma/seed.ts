import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding AgentStorm database...");

  // Clear existing data
  await prisma.product.deleteMany();
  await prisma.merchant.deleteMany();

  // Create merchant
  const merchant = await prisma.merchant.create({
    data: {
      name: "TechNova Store",
      email: "admin@technova.store",
    },
  });

  console.log(`✅ Created merchant: ${merchant.name} (${merchant.id})`);

  // Create products
  const products = [
    {
      name: "ProBook X14 Laptop",
      description:
        "14-inch ultrabook with Intel Core i5-1340P, 16GB RAM, 512GB SSD. Ideal for productivity and light creative work.",
      price: 54999.0,
      stock: 25,
      category: "laptops",
      attributes: {
        brand: "ProBook",
        processor: "Intel Core i5-1340P",
        ram: "16GB DDR5",
        storage: "512GB NVMe SSD",
        display: "14-inch FHD IPS",
        weight: "1.4kg",
      },
    },
    {
      name: "ProBook X16 Pro Laptop",
      description:
        "16-inch powerhouse with Intel Core i7-13700H, 32GB RAM, 1TB SSD, RTX 4060 GPU. Built for demanding workflows.",
      price: 89999.0,
      stock: 12,
      category: "laptops",
      attributes: {
        brand: "ProBook",
        processor: "Intel Core i7-13700H",
        ram: "32GB DDR5",
        storage: "1TB NVMe SSD",
        gpu: "NVIDIA RTX 4060",
        display: "16-inch QHD IPS 165Hz",
        weight: "2.1kg",
      },
    },
    {
      name: "ZenBook Air 13 Laptop",
      description:
        "Ultra-lightweight 13-inch laptop with AMD Ryzen 5 7530U, 8GB RAM, 256GB SSD. Perfect for students and commuters.",
      price: 42999.0,
      stock: 40,
      category: "laptops",
      attributes: {
        brand: "ZenBook",
        processor: "AMD Ryzen 5 7530U",
        ram: "8GB DDR4",
        storage: "256GB NVMe SSD",
        display: "13.3-inch FHD OLED",
        weight: "1.0kg",
      },
    },
    {
      name: "SonicWave Pro Headphones",
      description:
        "Over-ear wireless headphones with active noise cancellation, 40mm drivers, 30-hour battery life, and multipoint Bluetooth.",
      price: 7999.0,
      stock: 60,
      category: "headphones",
      attributes: {
        brand: "SonicWave",
        type: "Over-ear",
        connectivity: "Bluetooth 5.3",
        anc: true,
        battery: "30 hours",
        driver: "40mm",
      },
    },
    {
      name: "SonicWave Buds SE",
      description:
        "True wireless earbuds with 10mm drivers, IPX4 water resistance, 24-hour total battery with case, low-latency game mode.",
      price: 2499.0,
      stock: 100,
      category: "headphones",
      attributes: {
        brand: "SonicWave",
        type: "In-ear TWS",
        connectivity: "Bluetooth 5.2",
        anc: false,
        battery: "6h + 18h case",
        waterResistance: "IPX4",
      },
    },
    {
      name: "StudioCans Reference Headphones",
      description:
        "Wired studio monitoring headphones with flat frequency response, 50mm drivers, detachable cable, and memory foam pads.",
      price: 12499.0,
      stock: 20,
      category: "headphones",
      attributes: {
        brand: "StudioCans",
        type: "Over-ear wired",
        impedance: "64 ohms",
        driver: "50mm",
        frequencyResponse: "10Hz-40kHz",
        cableLength: "3m coiled",
      },
    },
    {
      name: "MechStrike TKL Keyboard",
      description:
        "Tenkeyless mechanical keyboard with hot-swappable switches, RGB backlighting, PBT keycaps, USB-C connection.",
      price: 5499.0,
      stock: 45,
      category: "keyboards",
      attributes: {
        brand: "MechStrike",
        layout: "TKL (87 keys)",
        switches: "Gateron Red (hot-swap)",
        keycaps: "PBT double-shot",
        backlighting: "Per-key RGB",
        connectivity: "USB-C wired",
      },
    },
    {
      name: "MechStrike 65% Wireless Keyboard",
      description:
        "Compact 65% wireless mechanical keyboard with tri-mode connectivity, 4000mAh battery, gasket mount, and south-facing LEDs.",
      price: 8999.0,
      stock: 30,
      category: "keyboards",
      attributes: {
        brand: "MechStrike",
        layout: "65% (68 keys)",
        switches: "Gateron Pro Yellow",
        connectivity: "Bluetooth / 2.4GHz / USB-C",
        battery: "4000mAh",
        mount: "Gasket",
      },
    },
    {
      name: "SwiftGlide Ergo Mouse",
      description:
        "Ergonomic wireless mouse with 26,000 DPI sensor, 70-hour battery, 6 programmable buttons, and USB-C charging.",
      price: 3499.0,
      stock: 55,
      category: "mice",
      attributes: {
        brand: "SwiftGlide",
        sensor: "PAW3395 (26000 DPI)",
        connectivity: "2.4GHz / Bluetooth",
        weight: "68g",
        buttons: 6,
        battery: "70 hours",
      },
    },
    {
      name: "SwiftGlide Ultralight Gaming Mouse",
      description:
        "Ultra-lightweight gaming mouse at 49g with honeycomb shell, paracord cable, PTFE skates, and 400 IPS tracking.",
      price: 2999.0,
      stock: 35,
      category: "mice",
      attributes: {
        brand: "SwiftGlide",
        sensor: "PAW3370 (19000 DPI)",
        connectivity: "USB wired (paracord)",
        weight: "49g",
        buttons: 5,
        skates: "100% PTFE",
      },
    },
    {
      name: "ClearView 27 QHD Monitor",
      description:
        "27-inch QHD IPS monitor with 165Hz refresh rate, 1ms response time, 95% DCI-P3, HDR400, USB-C with 65W PD.",
      price: 24999.0,
      stock: 18,
      category: "monitors",
      attributes: {
        brand: "ClearView",
        size: "27 inches",
        resolution: "2560x1440 (QHD)",
        panel: "IPS",
        refreshRate: "165Hz",
        responseTime: "1ms GtG",
        hdr: "HDR400",
        ports: ["HDMI 2.1", "DP 1.4", "USB-C 65W PD"],
      },
    },
    {
      name: "ClearView 32 4K Monitor",
      description:
        "32-inch 4K UHD IPS monitor with 60Hz, factory-calibrated colors, 98% DCI-P3, built-in KVM, and daisy-chain support.",
      price: 38999.0,
      stock: 10,
      category: "monitors",
      attributes: {
        brand: "ClearView",
        size: "32 inches",
        resolution: "3840x2160 (4K UHD)",
        panel: "IPS",
        refreshRate: "60Hz",
        colorAccuracy: "Delta E < 2",
        colorGamut: "98% DCI-P3",
        ports: ["HDMI 2.1", "DP 1.4", "USB-C 90W PD", "USB-B upstream"],
      },
    },
  ];

  for (const product of products) {
    const created = await prisma.product.create({
      data: {
        ...product,
        merchantId: merchant.id,
      },
    });
    console.log(`  📦 ${created.name} — ₹${created.price} (${created.category})`);
  }

  console.log(`\n✅ Seeded ${products.length} products for ${merchant.name}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ Seed failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
