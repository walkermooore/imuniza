# Imuniza — Servidor de Gerenciamento de Imunizantes

Este é o componente de backend do ecossistema Imuniza, uma solução em Node.js e PostgreSQL focada no monitoramento rigoroso de estoques de vacinas, desde a entrada do lote até o descarte final de cada frasco.

---

## O Propósito do Projeto

O sistema foi concebido para endereçar falhas comuns na logística de vacinação, como o desperdício por validade e a falta de rastreabilidade. Ele centraliza as operações de salas de vacinação, oferecendo:

- **Controle Preciso de Inventário**: Gestão detalhada por sala e por lote.
- **Inteligência Anti-Desperdício**: Sistema de alertas que impede a abertura redundante de frascos.
- **Histórico de Auditoria**: Registro completo de cada interação no sistema para conformidade e segurança.
- **Logística entre Unidades**: Suporte a transferências de insumos com regras de expiração automatizadas.

---

## Fluxo e Regras de Negócio

### Gerenciamento de Ciclo de Vida
1. **Cadastro de Lotes**: Registro das informações do fabricante e prazos.
2. **Distribuição**: Alocação de frascos para salas específicas via `batch_room_entries`.
3. **Uso**: Registro de abertura (`bottle_opening`) vinculado ao técnico responsável.
4. **Finalização**: Descarte documentado (`bottle_discard`) com justificativa técnica.

### Sistema de Alerta Inteligente
O backend valida se já existe um frasco aberto da mesma vacina na sala antes de permitir uma nova abertura. O tempo de verificação é dinâmico e pode ser ajustado através do parâmetro `intervalo_alerta_abertura_minutos`.

### Movimentação de Insumos
As transferências permitem o remanejamento de doses. O processo possui um temporizador de segurança; caso não seja aceito em até 48 horas (configurável), o sistema expira a solicitação automaticamente.

### Operações em Bloco (Bulk)
Suporta o processamento de múltiplos frascos simultaneamente para otimizar o fluxo de trabalho em campanhas de vacinação, tratando tanto frascos lacrados (Modo A) quanto já abertos (Modo B).

---

## Ferramentas e Tecnologias

| Tecnologia | Finalidade |
| :--- | :--- |
| **Node.js 20** | Ambiente de execução principal |
| **TypeScript** | Desenvolvimento com tipagem estática |
| **Express** | Roteamento e middleware |
| **PostgreSQL 15+** | Banco de dados relacional |
| **JWT** | Autenticação de usuários |
| **Bcrypt** | Proteção de credenciais |
| **Swagger** | Documentação de interface (OpenAPI) |

---

## Estrutura Arquitetural

A implementação segue os padrões da **Clean Architecture**, garantindo desacoplamento e facilidade de manutenção.

```
src/
├── domain/          # Contratos, entidades e lógica de domínio pura
├── application/     # Casos de uso (Lógica de negócio orquestrada)
├── infrastructure/  # Drivers, persistência (PostgreSQL) e serviços externos
├── interface/       # Adaptadores de entrada (HTTP/Express)
└── main/            # Composição e inicialização do sistema
```

### Detalhes de Implementação
- **Repositórios**: Camada de persistência isolada por interfaces.
- **Use Cases**: Cada operação do sistema possui seu próprio arquivo de lógica.
- **Auditoria**: Tabelas principais registram o criador (`created_by`) e o editor (`updated_by`).
- **Soft Delete**: Registros não são removidos fisicamente, mas marcados via `is_deleted`.

---

## Persistência de Dados

O schema está localizado em `database/01-ddl/01-core.sql`. Dados base e parâmetros iniciais em `database/02-data/`.

### Convenções de Banco
- Identificadores únicos via **UUID**.
- Auditoria nativa em todas as entidades críticas.
- Log de auditoria (`audit_logs`) imutável para segurança das informações.

---

## Configuração do Ambiente

### Requisitos Mínimos
- Node.js versão 20 ou superior.
- Instância ativa de PostgreSQL 15+.

### Variáveis de Controle (`.env`)
Crie o arquivo na raiz do backend:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/imunizeme
JWT_SECRET=sua_chave_mestra_aqui
JWT_EXPIRES_IN=7d
PORT=3000
```

### Comandos de Operação
```bash
# Iniciar em modo desenvolvimento
npm run dev

# Gerar build de produção
npm run build

# Iniciar aplicação compilada
npm run start

# Validar tipagem
npm run typecheck
```

---

## Guia de Endpoints (API)

Todas as requisições autenticadas devem enviar o token no header `Authorization: Bearer <token>`.

| Método | Caminho | Função |
| :--- | :--- | :--- |
| POST | `/auth/login` | Login e geração de Token |
| GET | `/users` | Listagem de usuários |
| POST | `/users` | Novo usuário |
| GET | `/locations` | Listar unidades de saúde |
| POST | `/vaccine-rooms` | Nova sala de vacina |
| GET | `/batches` | Consultar lotes disponíveis |
| POST | `/bottle-openings` | Registrar abertura de frasco |
| POST | `/batch-transfers` | Solicitar transferência |
| POST | `/bulk-bottle-openings` | Abertura em massa |

*Para a lista completa de endpoints, consulte a documentação Swagger em `/docs`.*

---

## Parâmetros Globais do Sistema

| Chave | Padrão | Descrição |
| :--- | :--- | :--- |
| `intervalo_alerta_abertura_minutos` | `600` | Janela de segurança para alerta de duplicidade |
| `expire_transfer_minutes` | `2880` | Prazo de 48h para resolução de transferências |
