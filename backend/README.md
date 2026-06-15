<p align="center">
  <img src="https://capsule-render.vercel.app/api?type=rect&color=0077b6&height=100&section=header&text=Imuniza%20Backend&fontSize=40&animation=fadeIn" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-20.x-green?style=for-the-badge&logo=node.js" />
  <img src="https://img.shields.io/badge/PostgreSQL-15%2B-blue?style=for-the-badge&logo=postgresql" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-blue?style=for-the-badge&logo=typescript" />
</p>

## 🎯 Objetivo
Core API responsável pela inteligência de negócio, validações de segurança e persistência de dados do sistema de vacinação.

---

## ⚙️ Arquitetura Clean
Seguimos rigorosamente os princípios de **Clean Architecture** para garantir testabilidade e independência de frameworks.

| Camada | Responsabilidade |
| :--- | :--- |
| **Domain** | Entidades, Regras de Negócio Puras e Contratos. |
| **Application** | Casos de Uso (Usecases) e Orquestração. |
| **Infrastructure** | Implementação de Banco, Repositórios e Serviços Externos. |
| **Interface** | Controllers HTTP, Middlewares e Adaptadores de Entrada. |

---

## 🧠 Lógicas Críticas

### 🛡️ Prevenção de Desperdício
Antes de permitir a abertura de um frasco, o sistema verifica a existência de frascos ativos da mesma vacina na sala, emitindo alertas inteligentes.

### 🚚 Gestão de Transferências
Fluxo de transferência com expiração automática (TTL) para garantir a integridade térmica e lógica dos frascos.

---

## 🛠️ Instalação e Execução

1. **Variaveis de Ambiente**:
   ```env
   DATABASE_URL=postgresql://user:password@localhost:5432/imuniza
   JWT_SECRET=sua_chave
   ```

2. **Comandos**:
   ```bash
   npm install
   npm run dev
   ```

---

## 📖 Documentação (Swagger)
Acesse a documentação completa dos endpoints em:
`GET /docs` (disponível em tempo de execução).

<p align="center">
  Construído com foco em resiliência. 🔐
</p>
