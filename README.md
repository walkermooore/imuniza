<p align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&color=00b4d8&height=300&section=header&text=Imuniza&fontSize=90&animation=fadeIn&fontAlignY=38" />
</p>

<p align="center">
  <a href="#-sobre">Sobre</a> •
  <a href="#-funcionalidades">Funcionalidades</a> •
  <a href="#-tecnologias">Tecnologias</a> •
  <a href="#-estrutura">Estrutura</a> •
  <a href="#-guia-de-uso">Guia de Uso</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Status-Em%20Desenvolvimento-yellow?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Vers%C3%A3o-1.0.0-blue?style=for-the-badge" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" />
</p>

---

## 📝 Sobre

O **Imuniza** é uma plataforma inteligente focada na **gestão, rastreabilidade e otimização** do estoque de vacinas. Desenvolvido para unidades de saúde, o sistema atua na prevenção ativa contra desperdícios, garantindo que cada frasco seja utilizado em seu potencial máximo e que todas as movimentações sejam auditáveis.

---

## ✨ Funcionalidades

| 🛡️ Segurança | 📊 Gestão | 🚀 Agilidade |
| :--- | :--- | :--- |
| **Alerta Anti-Desperdício**: Impede abertura de frascos redundantes. | **Rastreabilidade**: Ciclo de vida completo do lote ao descarte. | **Bulk Operations**: Processamento em massa para campanhas. |
| **Auditoria**: Log imutável de todas as ações no sistema. | **Transferências**: Movimentação segura entre unidades de saúde. | **Interface Intuitiva**: Dashboard focado na produtividade do técnico. |

---

## 🛠 Tecnologias

<table>
  <tr>
    <td align="center" width="120">
      <img src="https://raw.githubusercontent.com/devicons/devicon/master/icons/nodejs/nodejs-original.svg" width="40" height="40" alt="Node.js" />
      <br>Node.js
    </td>
    <td align="center" width="120">
      <img src="https://raw.githubusercontent.com/devicons/devicon/master/icons/react/react-original.svg" width="40" height="40" alt="React" />
      <br>React 19
    </td>
    <td align="center" width="120">
      <img src="https://raw.githubusercontent.com/devicons/devicon/master/icons/typescript/typescript-original.svg" width="40" height="40" alt="TypeScript" />
      <br>TypeScript
    </td>
    <td align="center" width="120">
      <img src="https://raw.githubusercontent.com/devicons/devicon/master/icons/postgresql/postgresql-original.svg" width="40" height="40" alt="PostgreSQL" />
      <br>PostgreSQL
    </td>
    <td align="center" width="120">
      <img src="https://raw.githubusercontent.com/devicons/devicon/master/icons/tailwindcss/tailwindcss-original-wordmark.svg" width="40" height="40" alt="Tailwind" />
      <br>Tailwind
    </td>
  </tr>
</table>

---

## 📂 Estrutura do Ecossistema

```mermaid
graph TD
    A[Root] --> B[Backend - Node.js/Clean Arch]
    A --> C[Frontend - React/Vite]
    B --> D[(PostgreSQL DB)]
    C --> B
```

- 📂 **[backend](./backend)**: API robusta com Clean Architecture e Swagger.
- 📂 **[frontend](./frontend)**: Portal do usuário moderno com React 19 e shadcn/ui.

---

## 🚀 Guia de Uso

### 🗄️ 1. Banco de Dados
Execute os scripts SQL localizados em `backend/database/` na ordem numérica.

### ⚙️ 2. Backend
```bash
cd backend
npm install
npm run dev
```

### 🖥️ 3. Frontend
```bash
cd frontend
npm install
npm run dev
```

---

<p align="center">
  <img src="./frontend/public/logo.svg" width="50" height="50" />
  <br>
  Desenvolvido com ❤️ para a saúde pública.
</p>
