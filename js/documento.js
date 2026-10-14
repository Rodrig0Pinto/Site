/* Visualizador de documento processual por link/QR Code.
 * O link traz #d=<ID>&k=<CHAVE>. O trecho após "#" não é enviado ao servidor:
 * o arquivo dados/docs/<ID>.bin chega cifrado e é decifrado aqui, no navegador
 * (AES-256-GCM). Formato: "RPD1" | IV (12) | cifrado(tamCab u32 | cabeçalho JSON | PDF).
 * Gerado por ferramentas/publicar-documento.mjs.
 */
(function () {
    "use strict";

    var alvo = document.getElementById("docResultado");
    if (!alvo) return;

    function el(tag, cls, txt) {
        var e = document.createElement(tag);
        if (cls) e.className = cls;
        if (txt != null) e.textContent = txt;
        return e;
    }

    function aviso(titulo, texto) {
        alvo.textContent = "";
        var c = el("div", "doc-card doc-erro");
        c.appendChild(el("h2", null, titulo));
        c.appendChild(el("p", null, texto));
        alvo.appendChild(c);
    }

    function deB64url(s) {
        s = s.replace(/-/g, "+").replace(/_/g, "/");
        while (s.length % 4) s += "=";
        var bin = atob(s), out = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
        return out;
    }

    function hex(buf) {
        return Array.prototype.map.call(new Uint8Array(buf), function (b) {
            return ("0" + b.toString(16)).slice(-2);
        }).join("");
    }

    function dataBr(iso) {
        var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
        return m ? m[3] + "/" + m[2] + "/" + m[1] : "—";
    }

    var p = new URLSearchParams(location.hash.slice(1));
    var id = p.get("d") || "", k = p.get("k") || "";
    if (!/^[A-Za-z0-9_-]{22}$/.test(id) || !/^[A-Za-z0-9_-]{43}$/.test(k)) {
        aviso("Link incompleto", "Abra o documento pelo QR Code ou pelo link completo enviado pelo escritório.");
        return;
    }
    if (!window.crypto || !crypto.subtle) {
        aviso("Navegador não compatível", "Atualize o navegador ou abra o link no Safari, Chrome, Edge ou Firefox.");
        return;
    }

    fetch("/dados/docs/" + id + ".bin", { cache: "no-store" })
        .then(function (r) {
            if (r.status === 404) throw new Error("revogado");
            if (!r.ok) throw new Error("rede");
            return r.arrayBuffer();
        })
        .then(function (buf) {
            var b = new Uint8Array(buf);
            if (b.length < 32 || String.fromCharCode(b[0], b[1], b[2], b[3]) !== "RPD1") throw new Error("formato");
            return crypto.subtle.importKey("raw", deB64url(k), "AES-GCM", false, ["decrypt"])
                .then(function (chave) {
                    return crypto.subtle.decrypt(
                        { name: "AES-GCM", iv: b.slice(4, 16), additionalData: new TextEncoder().encode(id) },
                        chave, b.slice(16));
                })
                .catch(function () { throw new Error("chave"); });
        })
        .then(function (claro) {
            var dv = new DataView(claro);
            var tam = dv.getUint32(0);
            var cab = JSON.parse(new TextDecoder().decode(new Uint8Array(claro, 4, tam)));
            var pdf = new Uint8Array(claro, 4 + tam);
            return crypto.subtle.digest("SHA-256", pdf).then(function (h) {
                if (hex(h) !== cab.sha256) throw new Error("integridade");
                exibir(cab, pdf);
            });
        })
        .catch(function (e) {
            var m = {
                revogado: ["Documento indisponível", "Este documento não está mais disponível neste endereço. Em caso de dúvida, fale com o escritório."],
                chave: ["Link inválido", "A chave de acesso não confere com o documento. Use o QR Code ou o link completo, sem alterações."],
                integridade: ["Falha de integridade", "O conteúdo não corresponde ao registrado na publicação e não será exibido."],
                formato: ["Arquivo inválido", "O arquivo publicado não está no formato esperado."]
            }[e.message] || ["Falha de conexão", "Não foi possível carregar o documento agora. Tente novamente em instantes."];
            aviso(m[0], m[1]);
        });

    function exibir(cab, pdf) {
        var url = URL.createObjectURL(new Blob([pdf], { type: "application/pdf" }));
        alvo.textContent = "";

        var c = el("div", "doc-card");
        c.appendChild(el("span", "doc-selo", "Integridade verificada · SHA-256 confere"));
        c.appendChild(el("h2", null, cab.titulo || "Documento processual"));

        var dl = el("dl", "doc-dados");
        [
            ["Processo", cab.processo],
            ["Arquivo", cab.nome],
            ["Publicado em", dataBr(cab.publicado)],
            ["Código de verificação", cab.codigo || "Consta no próprio PDF"],
            ["SHA-256", cab.sha256]
        ].forEach(function (par) {
            dl.appendChild(el("dt", null, par[0]));
            dl.appendChild(el("dd", par[0] === "SHA-256" ? "doc-hash" : null, par[1]));
        });
        c.appendChild(dl);

        var botoes = el("div", "doc-botoes");
        var abrir = el("a", "btn btn-gold", "Abrir o documento (PDF)");
        abrir.href = url; abrir.target = "_blank"; abrir.rel = "noopener";
        var baixar = el("a", "btn btn-outline-doc", "Baixar PDF");
        baixar.href = url; baixar.download = cab.nome || "documento.pdf";
        botoes.appendChild(abrir); botoes.appendChild(baixar);
        c.appendChild(botoes);

        if (/^https:\/\//.test(cab.conferencia || "")) {
            var conf = el("p", "doc-conferencia");
            conf.appendChild(document.createTextNode("Confira a autenticidade diretamente no sistema do Tribunal: "));
            var a = el("a", null, cab.conferencia);
            a.href = cab.conferencia; a.target = "_blank"; a.rel = "noopener noreferrer";
            conf.appendChild(a);
            c.appendChild(conf);
        }
        alvo.appendChild(c);
    }
})();
