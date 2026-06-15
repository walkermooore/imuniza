# Imuniza — Sistema de Gestão de Vacinação

Bem-vindo ao repositório do **Imuniza**, uma solução completa para o controle e rastreabilidade de frascos de vacinas em unidades de saúde.

Este projeto foi desenvolvido com uma arquitetura moderna e escalável, utilizando **TypeScript** em todo o ecossistema para garantir robustez e segurança nos dados.

---

## 📂 Estrutura do Projeto

O repositório está organizado em uma estrutura de monorepo simplificada para facilitar o desenvolvimento e a manutenção:

### 🖥️ [Frontend](./frontend)
Interface web desenvolvida com **React 19** e **Vite**. 
- Focada na experiência do usuário (UX) para profissionais de saúde.
- Design responsivo com **Tailwind CSS** e **shadcn/ui**.
- Gerenciamento de estado global com **Zustand**.
- Navegação otimizada com **TanStack Router**.

### ⚙️ [Backend](./backend)
API REST robusta construída com **Node.js 20**.
- Arquitetura baseada nos princípios de **Clean Architecture**.
- Banco de dados relacional **PostgreSQL 15+**.
- Autenticação segura via **JWT** e criptografia de senhas com **bcrypt**.
- Documentação automática dos endpoints através do **Swagger (OpenAPI)**.

---

## 🚀 Como iniciar

Para rodar o projeto localmente, você deve configurar cada parte separadamente. Siga as instruções detalhadas nos arquivos README de cada diretório:

1.  **Configuração do Banco de Dados**: Utilize os scripts SQL em `backend/database/`.
2.  **Configuração do Backend**: Veja o [README do Backend](./backend/README.md).
3.  **Configuração do Frontend**: Veja o [README do Frontend](./frontend/README.md).

---
