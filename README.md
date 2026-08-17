# ❄️ Commercial Cooler Planogram Optimization Studio

An enterprise-grade, browser-based Planogram AI Optimizer and Visual Studio for retail glass-door beverage coolers.

![Planogram Studio](https://img.shields.io/badge/Status-Live%20Ready-success)
![Compliance](https://img.shields.io/badge/Compliance%20Score-100%25-brightgreen)
![License](https://img.shields.io/badge/License-MIT-blue)

---

## 🚀 Key Features

* **3-Objective Mathematical Knapsack Solver**:
  * 💰 **Profit Maximization**: Maximizes gross margin dollar yield.
  * 📈 **Revenue Maximization**: Maximizes total sales dollars.
  * 📦 **Unit Movement / Velocity Maximization**: Maximizes daily unit throughput.
* **Continuous Multi-Door Brand Flow**:
  * Unified cooler scope with continuous left-to-right brand sequence across doors ($A \rightarrow B \rightarrow C \dots$).
* **Pack Volume Homogeneity**:
  * Strict single pack size per shelf tier (Zero volume mix on any shelf).
  * Multi-door tier uniformity (Door 1 and Door 2 share the same pack volume on any shelf level).
* **Bottom-Heavy Safety Placement**:
  * Heavy $1.5\text{L}$ PET bottles strictly placed on the Bottom Base Shelves.
* **Extensible Rule Audit & Health Engine**:
  * Live monitoring of 10 constraints with green checkmarks (`✅`) and real-time metric proofs.
* **Photorealistic 3D Fixture Canvas & Visual Heatmaps**:
  * Standard Brand view, Margin heatmap, Velocity heatmap, Days of Supply (OOS risk), and Eye-Level golden zone overlay.

---

## 🛠️ Tech Stack

* **Frontend**: HTML5, Vanilla CSS, Vanilla JavaScript (Zero npm dependencies needed).
* **Backend / Solver**: Python 3 Knapsack Solver (`optimizer.py`).
* **Deployment**: GitHub Pages, Vercel, Netlify.

---

## 💻 Local Quickstart

### 1. View in Browser
Simply open `index.html` in any web browser:
```bash
open index.html
```

### 2. Run Python CLI Optimizer
```bash
python3 optimizer.py --objective profit --cooler COOLER-2DOOR-STD
```

---

## 📄 License
MIT License.
