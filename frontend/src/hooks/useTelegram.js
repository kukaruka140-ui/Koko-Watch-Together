// ============================================================
//  useTelegram.js — Хук для работы с Telegram WebApp SDK
// ============================================================

import { useEffect, useState } from 'react';

/**
 * Возвращает данные из Telegram WebApp API.
 * В dev-режиме (вне Telegram) возвращает mock-данные.
 */
export function useTelegram() {
  const [tgData, setTgData] = useState({
    user:      null,
    initData:  '',
    colorScheme: 'dark',
    isReady:   false
  });

  useEffect(() => {
    // Telegram WebApp API доступен через window.Telegram
    const tg = window?.Telegram?.WebApp;

    if (tg) {
      // Сообщаем Telegram, что приложение готово
      tg.ready();
      // Расширяем на весь экран
      tg.expand();
      // Включаем тёмную тему
      tg.setHeaderColor('#0A0A0F');
      tg.setBackgroundColor('#0A0A0F');
      // Закрываем кнопку закрытия — управление внутри приложения
      tg.enableClosingConfirmation();

      setTgData({
        user:        tg.initDataUnsafe?.user || null,
        initData:    tg.initData || '',
        colorScheme: tg.colorScheme || 'dark',
        isReady:     true
      });
    } else {
      // Dev-режим: mock данные
      console.warn('[useTelegram] Telegram WebApp API не найден. Работаем в dev-режиме.');
      setTgData({
        user: {
          id:         999999,
          first_name: 'Dev',
          last_name:  'User',
          username:   'devuser'
        },
        initData:    '',
        colorScheme: 'dark',
        isReady:     true
      });
    }
  }, []);

  return tgData;
}
