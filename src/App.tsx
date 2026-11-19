import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Copy, Lock, ShieldCheck } from 'lucide-react';
import { AudioGuidePlayer } from './components/AudioGuidePlayer';
import { PaymentInstructions } from './components/PaymentInstructions';
import { PixDiamondIcon } from './components/PixBrandIcons';
import { PixPaymentCard } from './components/PixPaymentCard';
import { PIX_PAYMENT_CONFIG } from './constants/pixData';
import { copyToClipboard } from './utils/copyToClipboard';

export default function App() {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const handleCopyPixKey = useCallback(async () => {
    const success = await copyToClipboard(PIX_PAYMENT_CONFIG.pixKey);

    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }

    if (success) {
      setCopyError(false);
      setCopied(true);
      resetTimerRef.current = window.setTimeout(() => {
        setCopied(false);
      }, 4500);
    } else {
      setCopied(false);
      setCopyError(true);
    }
  }, []);

  return (
    <div
      id="top"
      className="min-h-screen flex flex-col bg-[#040E21] text-white overflow-x-hidden relative"
      style={{
        backgroundImage:
          'radial-gradient(ellipse 80% 45% at 50% -5%, rgba(0, 158, 227, 0.28), transparent 70%), radial-gradient(circle at 85% 32%, rgba(0, 82, 204, 0.2), transparent 45%)',
      }}
    >
      {/* Top Navigation Bar — 3-zone contract */}
      <header className="sticky top-0 z-30 bg-[#040E21]/85 backdrop-blur-md border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3 sm:gap-8">
          <a
            href="#top"
            className="font-display text-base sm:text-lg font-extrabold tracking-tight text-white whitespace-nowrap shrink-0 flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFE600] rounded-lg px-1"
          >
            <PixDiamondIcon className="w-5 h-5 text-[#009EE3] shrink-0" />
            <span>Pagamento via Pix</span>
          </a>

          <nav
            aria-label="Navegação da página"
            className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-200"
          >
            <a
              href="#dados-pix"
              className="hover:text-[#FFE600] transition-colors whitespace-nowrap shrink-0 py-1"
            >
              Dados do Pix
            </a>
            <a
              href="#audio-explicativo"
              className="hover:text-[#FFE600] transition-colors whitespace-nowrap shrink-0 py-1"
            >
              Áudio
            </a>
            <a
              href="#instrucoes"
              className="hover:text-[#FFE600] transition-colors whitespace-nowrap shrink-0 py-1"
            >
              Instruções
            </a>
            <a
              href="#conferencia"
              className="hover:text-[#FFE600] transition-colors whitespace-nowrap shrink-0 py-1"
            >
              Conferência
            </a>
          </nav>

          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={handleCopyPixKey}
              className={`min-h-[44px] px-3 sm:px-4 py-2 rounded-xl font-display text-xs sm:text-sm font-bold flex items-center gap-1.5 sm:gap-2 transition-all duration-150 active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#040E21] ${
                copied
                  ? 'bg-emerald-600 text-white focus-visible:ring-emerald-400'
                  : 'bg-[#FFE600] hover:bg-[#FFD900] text-[#040E21] focus-visible:ring-[#FFE600]'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Copiada</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Copiar chave Pix</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Centered Hero Header */}
        <section aria-labelledby="hero-heading" className="max-w-3xl mx-auto text-center pb-8 sm:pb-10">
          <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-sm font-semibold text-sky-200">
            <span className="text-[#FFE600]">Transferência instantânea</span>
            <span aria-hidden="true" className="text-white/30">
              ·
            </span>
            <span>{PIX_PAYMENT_CONFIG.bankName}</span>
            <span aria-hidden="true" className="text-white/30">
              ·
            </span>
            <span>Disponível 24h</span>
          </div>

          <h1
            id="hero-heading"
            className="mt-3 font-display font-extrabold tracking-tight text-white text-balance leading-[1.1]"
            style={{ fontSize: 'clamp(1.85rem, 3.8vw, 2.95rem)' }}
          >
            Pagamento Pix para{' '}
            <span className="text-[#4CC3FF]">{PIX_PAYMENT_CONFIG.recipientName}</span>
          </h1>

          <p className="mt-4 text-base sm:text-lg text-slate-200 leading-relaxed max-w-2xl mx-auto">
            Utilize a chave oficial do{' '}
            <strong className="font-bold text-white">{PIX_PAYMENT_CONFIG.bankName}</strong> abaixo
            para transferir com agilidade e segurança, ou ouça as instruções em áudio.
          </p>
        </section>

        {/* Centered Premium Card Stage */}
        <div className="max-w-3xl mx-auto space-y-6">
          <PixPaymentCard
            copied={copied}
            copyError={copyError}
            onCopyPixKey={handleCopyPixKey}
          />

          <AudioGuidePlayer />
        </div>

        {/* Numbered Instructions Section */}
        <PaymentInstructions />

        {/* Pre-Confirmation Summary */}
        <section id="conferencia" aria-labelledby="conferencia-heading" className="pt-12 sm:pt-14">
          <div className="rounded-3xl bg-gradient-to-r from-[#081B3E] to-[#0C2756] border border-[#1E4182] p-6 sm:p-8 shadow-lg">
            <div className="flex items-start gap-3.5">
              <span className="w-10 h-10 rounded-xl bg-[#009EE3]/20 border border-[#009EE3]/40 text-[#4CC3FF] flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" aria-hidden="true" />
              </span>
              <div>
                <h2
                  id="conferencia-heading"
                  className="font-display text-lg sm:text-xl font-bold tracking-tight text-white"
                >
                  Conferência final antes de confirmar no banco
                </h2>
                <p className="mt-1 text-sm sm:text-base text-slate-200">
                  Ao colar a chave Pix, certifique-se de que a tela de confirmação do seu banco exibe exatamente os dados abaixo:
                </p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-white/10">
              <div>
                <p className="text-xs font-semibold text-sky-200">Nome do favorecido</p>
                <p className="mt-1 font-display text-base font-bold text-white uppercase">
                  {PIX_PAYMENT_CONFIG.recipientName}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold text-sky-200">Instituição de destino</p>
                <p className="mt-1 font-display text-base font-extrabold text-[#FFE600] uppercase">
                  {PIX_PAYMENT_CONFIG.bankName}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold text-sky-200">Após concluir o Pix</p>
                <p className="mt-1 text-base font-medium text-slate-100">
                  Salve ou envie o comprovante emitido pelo seu aplicativo bancário.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Dark Navy Footer */}
      <footer className="border-t border-white/10 bg-[#030A18] mt-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sm text-slate-300">
          <p className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#009EE3] shrink-0" aria-hidden="true" />
            <span>
              Recebedor: <strong className="font-semibold text-white">{PIX_PAYMENT_CONFIG.recipientName}</strong> · {PIX_PAYMENT_CONFIG.bankName}
            </span>
          </p>
          <p className="text-slate-400">Pagamento direto via Pix</p>
        </div>
      </footer>
    </div>
  );
}
