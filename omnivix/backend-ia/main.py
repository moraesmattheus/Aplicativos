# main.py
# Backend local da extensao. Roda no SEU computador (127.0.0.1) e faz o que a extensao
# nao deve fazer sozinha: guardar a chave da IA e chamar a IA.
#
# Regras de seguranca deste arquivo:
# 1. Nenhuma chave aparece no codigo. Tudo vem do arquivo .env (que o git ignora).
# 2. Toda rota exige o cabecalho X-Token com o API_TOKEN. Sem isso, qualquer site aberto
#    no navegador poderia chamar o seu servidor local e gastar sua chave.
# 3. Para a IA mandamos so o TITULO e o DOMINIO das abas, nunca a URL completa
#    (URLs podem ter tokens, ids de sessao e dados pessoais na parte depois do "?").

import json
import os
import secrets
from urllib.parse import urlparse

from anthropic import Anthropic
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Le o arquivo .env (se existir) e coloca os valores em os.environ.
load_dotenv()

API_TOKEN = os.environ.get("API_TOKEN", "")
MODELO = os.environ.get("MODEL", "claude-haiku-4-5-20251001")
MAX_ABAS = 150  # limite para nao enviar uma lista gigante (custo e privacidade)

app = FastAPI(title="Foco TDAH - backend local")

# CORS = quais "origens" podem chamar este servidor pelo navegador.
# Extensoes tem origem "chrome-extension://<id>". O regex aceita so esse formato.
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^chrome-extension://[a-p]{32}$",
    allow_methods=["GET", "POST"],
    allow_headers=["X-Token", "Content-Type"],
)


def exigir_token(x_token: str = Header(default="")) -> None:
    """Recusa a chamada se o token estiver ausente ou errado."""
    if not API_TOKEN:
        # Falha fechada: sem token configurado o servidor nao atende nada.
        raise HTTPException(status_code=500, detail="API_TOKEN nao configurado no .env")
    # compare_digest compara em tempo constante (evita ataque por medir o tempo).
    if not secrets.compare_digest(x_token, API_TOKEN):
        raise HTTPException(status_code=401, detail="Token invalido")


# ---------- Modelos de dados (o que entra e o que sai) ----------

class AbaEntrada(BaseModel):
    id: int
    title: str = Field(default="", max_length=300)
    url: str = Field(default="", max_length=2000)


class PedidoAgrupar(BaseModel):
    abas: list[AbaEntrada] = Field(max_length=MAX_ABAS)


class Grupo(BaseModel):
    nome: str
    ids: list[int]


class RespostaAgrupar(BaseModel):
    grupos: list[Grupo]


# ---------- Rotas ----------

@app.get("/health")
def saude() -> dict:
    """Teste simples: o servidor esta no ar? (nao exige token)"""
    return {"ok": True}


@app.post("/ai/group-tabs", response_model=RespostaAgrupar, dependencies=[Depends(exigir_token)])
def agrupar_abas(pedido: PedidoAgrupar) -> RespostaAgrupar:
    """Recebe as abas e devolve grupos por assunto, sugeridos pela IA."""
    if not pedido.abas:
        return RespostaAgrupar(grupos=[])

    chave = os.environ.get("ANTHROPIC_API_KEY", "")
    if not chave:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY nao configurada no .env")

    # Monta uma lista curta: id, titulo e so o dominio.
    linhas = [
        {"id": aba.id, "titulo": aba.title[:120], "site": urlparse(aba.url).netloc}
        for aba in pedido.abas
    ]

    instrucao = (
        "Agrupe estas abas de navegador por assunto ou projeto. "
        "Use de 2 a 8 grupos, nomes curtos em portugues (maximo 3 palavras), sem emoji. "
        "Toda aba deve ficar em exatamente um grupo. "
        'Responda SOMENTE JSON: {"grupos":[{"nome":"...","ids":[1,2]}]}\n\n'
        + json.dumps(linhas, ensure_ascii=False)
    )

    cliente = Anthropic(api_key=chave)
    resposta = cliente.messages.create(
        model=MODELO,
        max_tokens=2000,
        messages=[{"role": "user", "content": instrucao}],
    )
    texto = resposta.content[0].text

    # Nunca confie cegamente na saida da IA: valida o formato e os ids.
    try:
        dados = json.loads(texto[texto.index("{") : texto.rindex("}") + 1])
        grupos = RespostaAgrupar(**dados).grupos
    except (ValueError, TypeError) as erro:
        raise HTTPException(status_code=502, detail="Resposta da IA em formato invalido") from erro

    ids_validos = {aba.id for aba in pedido.abas}
    limpos = [
        Grupo(nome=g.nome.strip()[:40], ids=[i for i in g.ids if i in ids_validos])
        for g in grupos
    ]
    return RespostaAgrupar(grupos=[g for g in limpos if g.ids])
