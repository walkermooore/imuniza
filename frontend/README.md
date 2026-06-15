# ImunizeMe — Portal do Usuário e Gestão

Frontend do sistema ImunizeMe, desenvolvido para fornecer uma interface ágil e moderna aos profissionais de saúde e transparência à população sobre a disponibilidade de vacinas.

---

## Visão Geral do Sistema

O Portal ImunizeMe centraliza as operações do dia a dia das unidades de vacinação. Com foco em usabilidade, a interface permite gerenciar todo o ciclo de vida dos imunizantes, garantindo que o técnico em enfermagem tenha as informações necessárias para evitar desperdícios.

### Funcionalidades em Destaque
- **Gestão de Operações**: Abertura e descarte de frascos com poucos cliques.
- **Prevenção de Erros**: Alertas visuais imediatos ao tentar abrir um frasco quando já houver outro disponível.
- **Rastreabilidade**: Acompanhamento histórico de todas as movimentações por sala.
- **Painel de Disponibilidade**: Consulta pública para o cidadão verificar estoques nas UBSs locais.
- **Hierarquia de Acesso**: Interface adaptável para perfis de Técnico, Gestor e Administrador.

---

## Lógica de Funcionamento

### Fluxo de Trabalho
1. **Inventário**: Visualização dos lotes (`Batch`) e entradas por sala (`BatchRoomEntry`).
2. **Ação**: Registro de abertura de frasco com validação automática de duplicidade.
3. **Descarte**: Registro do motivo da perda ou finalização do frasco.

### Processamento em Massa
A interface simplifica o trabalho em campanhas, permitindo o processamento coletivo de frascos tanto lacrados quanto em uso, otimizando o tempo do profissional.

---

## Stack de Desenvolvimento

| Biblioteca/Framework | Utilização |
| :--- | :--- |
| **React 19** | Base da interface e componentes |
| **Vite** | Ferramenta de build e bundling |
| **TypeScript** | Segurança e tipagem em todo o projeto |
| **TanStack Router** | Gerenciamento de rotas e navegação |
| **Zustand** | Controle de estado global simplificado |
| **Tailwind CSS** | Estilização responsiva e utilitária |
| **shadcn/ui** | Componentes de UI consistentes |

---

## Organização do Projeto

```
src/
├── app/
│   ├── layouts/     # Estrutura base da página (Sidebar, Header)
│   ├── pages/       # Telas principais do sistema
│   └── router.tsx   # Configuração central de rotas
├── components/
│   ├── layout/      # Componentes estruturais (Navegação)
│   └── ui/          # Primitivas de UI (Botões, Modais, Tabelas)
├── hooks/           # Lógica de interface reutilizável
├── lib/             # Clientes de API e utilitários core
└── stores/          # Estados globais (Auth, Sidebar)
```

---

## Como Executar Localmente

### Preparação
- Node.js versão 20 ou superior instalado.

### Passo a Passo
1. Acesse o diretório `frontend/`.
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Configure as variáveis de ambiente (`.env`):
   ```env
   VITE_API_URL=http://localhost:3000
   ```
4. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

---

## Perfis e Permissões de Acesso

A interface se adapta conforme o papel do usuário logado:

- **Administrador**: Controle total, incluindo configurações de sistema e usuários.
- **Gestor**: Foco em monitoramento de unidades, salas e estoques.
- **Técnico**: Operações diretas de abertura, descarte e controle de uso diário.

---
Interface otimizada para a agilidade no serviço de saúde.
