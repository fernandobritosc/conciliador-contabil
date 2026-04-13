/**
 * Utilitário de Logger Profissional
 * Gerencia logs de desenvolvimento e erros críticos de produção para evitar perda de dados.
 */

const isProd = import.meta.env.PROD;

export const logger = {
    debug: (...args: any[]) => {
        if (!isProd) {
            console.log('DEBUG:', ...args);
        }
    },

    info: (...args: any[]) => {
        console.info('INFO:', ...args);
    },

    warn: (...args: any[]) => {
        console.warn('WARN:', ...args);
    },

    error: (message: string, error?: any, context?: Record<string, any>) => {
        console.error(`ERROR: ${message}`, {
            error,
            context,
            timestamp: new Date().toISOString(),
        });

        // Futura integração com Sentry/Logfire pode ser adicionada aqui
    },

    // Log específico para auditoria de persistência
    audit: (action: string, success: boolean, data?: any) => {
        const level = success ? 'info' : 'error';
        const msg = `AUDIT [${action}]: ${success ? 'SUCCESS' : 'FAILURE'}`;

        if (success) {
            console.log(msg, data ? '(Dados omitidos por privacidade)' : '');
        } else {
            console.error(msg, data);
        }
    }
};
