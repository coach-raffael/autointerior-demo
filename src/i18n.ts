import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Lang = 'ka' | 'en' | 'ru'
export const LANGS: { id: Lang; label: string }[] = [
  { id: 'ka', label: 'ქარ' },
  { id: 'en', label: 'EN' },
  { id: 'ru', label: 'РУ' },
]

type Entry = Record<Lang, string>

// Public-site copy. Georgian & Russian need a native read before launch.
const dict = {
  nav_work: { ka: 'ნამუშევრები', en: 'Work', ru: 'Работы' },
  nav_process: { ka: 'პროცესი', en: 'How it works', ru: 'Процесс' },
  nav_parts: { ka: 'ნაწილები', en: 'Parts', ru: 'Запчасти' },
  nav_order: { ka: 'შეკვეთა', en: 'Book', ru: 'Заказ' },
  nav_admin: { ka: 'ადმინი', en: 'Admin', ru: 'Админ' },

  hero_kicker: { ka: 'ტორპედოს გადაკვრა · თბილისი', en: 'Dashboard re-trimming in Tbilisi', ru: 'Перетяжка торпедо в Тбилиси' },
  hero_title: {
    ka: 'თქვენი ტორპედო, ახალ ტყავში.',
    en: 'Your dashboard, in new leather.',
    ru: 'Ваша торпеда — в новой коже.',
  },
  hero_sub: {
    ka: 'ვხსნით, ვჭრით, ვკერავთ ხელით და ვაბრუნებთ ადგილზე. Bentley-დან W140-მდე — ქარხნულ ნაკერზე უფრო სუფთად.',
    en: 'We take it out, cut it, hand-stitch it and fit it back. From Bentley to W140 — cleaner than the factory seam.',
    ru: 'Снимаем, кроим, шьём вручную и ставим обратно. От Bentley до W140 — аккуратнее заводского шва.',
  },
  hero_try: { ka: 'სცადეთ ტყავი და ნაკერი', en: 'Try a leather and stitch', ru: 'Подберите кожу и строчку' },

  cfg_leather: { ka: 'ტყავი', en: 'Leather', ru: 'Кожа' },
  cfg_finish: { ka: 'ზედაპირი', en: 'Finish', ru: 'Фактура' },
  cfg_thread: { ka: 'ძაფი', en: 'Thread', ru: 'Нить' },
  cfg_style: { ka: 'ნაკერი', en: 'Seam', ru: 'Шов' },
  cfg_single: { ka: 'ერთმაგი', en: 'Single', ru: 'Одинарный' },
  cfg_double: { ka: 'ორმაგი', en: 'Double', ru: 'Двойной' },
  cfg_request: { ka: 'მოითხოვე ეს ვარიანტი', en: 'Request this look', ru: 'Хочу такой вариант' },
  cfg_from: { ka: 'ფასი იწყება', en: 'Full dashboard from', ru: 'Торпеда целиком от' },

  finish_nappa: { ka: 'ნაპა', en: 'Nappa', ru: 'Наппа' },
  finish_alcantara: { ka: 'ალკანტარა', en: 'Alcantara', ru: 'Алькантара' },
  finish_perforated: { ka: 'პერფორირებული', en: 'Perforated', ru: 'Перфорация' },

  process_title: { ka: 'როგორ ვმუშაობთ', en: 'How a dashboard gets re-trimmed', ru: 'Как мы перетягиваем торпедо' },
  p1_t: { ka: 'დემონტაჟი', en: 'Removal', ru: 'Демонтаж' },
  p1_d: { ka: 'ტორპედოს ფრთხილად ვხსნით, ეარბეგებს და სენსორებს ვინიშნავთ.', en: 'The dashboard comes out in one piece. Airbags and sensors are labelled and set aside.', ru: 'Снимаем торпедо целиком, подушки и датчики маркируем.' },
  p2_t: { ka: 'მომზადება', en: 'Prep', ru: 'Подготовка' },
  p2_d: { ka: 'ძველ საფარს ვაშორებთ, ზედაპირს ვასწორებთ და ქაფის ფენას ვაკრავთ.', en: 'Old skin is stripped, cracks are filled, and a fresh foam layer goes on.', ru: 'Снимаем старое покрытие, выравниваем, клеим новый слой поролона.' },
  p3_t: { ka: 'ჭრა და კერვა', en: 'Cut & sew', ru: 'Крой и шитьё' },
  p3_d: { ka: 'თარგს ვჭრით თქვენს ტორპედოზე და ვკერავთ არჩეული ძაფით.', en: 'Patterns are cut to your exact dashboard and sewn with the thread you chose.', ru: 'Выкройка снимается именно с вашей торпеды, шьём выбранной нитью.' },
  p4_t: { ka: 'აწყობა', en: 'Refit', ru: 'Сборка' },
  p4_d: { ka: 'ვაკრავთ, ვაწყობთ და ვამოწმებთ ყველა ღილაკს და ეარბეგის შეცდომას.', en: 'Wrapped, refitted and checked: every switch, vent and airbag light.', ru: 'Обтягиваем, собираем и проверяем все кнопки и ошибки подушек.' },
  process_time: { ka: 'ჩვეულებრივ 3–5 სამუშაო დღე', en: 'Usually 3–5 working days', ru: 'Обычно 3–5 рабочих дней' },

  work_title: { ka: 'ბოლო ნამუშევრები', en: 'Recent work', ru: 'Последние работы' },
  work_all: { ka: 'ყველა', en: 'All', ru: 'Все' },
  work_ig: { ka: 'მეტი Instagram-ზე', en: 'More on Instagram', ru: 'Больше в Instagram' },

  parts_title: { ka: 'ნაწილები თქვენი მოდელისთვის', en: 'Parts for your model', ru: 'Запчасти под вашу модель' },
  parts_sub: {
    ka: 'გადაკრული ტორპედოები გაცვლით, საჭეები და კარის პანელები. აირჩიეთ მარკა და მოდელი.',
    en: 'Re-trimmed exchange dashboards, steering wheels and door cards. Pick your make and model.',
    ru: 'Перетянутые торпеды по обмену, рули и карты дверей. Выберите марку и модель.',
  },
  parts_service: { ka: 'გადაკვრა თქვენს ნაწილზე', en: 'Re-trim your own part', ru: 'Перетяжка вашей детали' },
  parts_service_d: { ka: 'ყოველთვის ხელმისაწვდომია ამ მოდელისთვის', en: 'Always available for this model', ru: 'Всегда доступно для этой модели' },
  parts_none: { ka: 'ამ მოდელზე ნაწილი ახლა არ გვაქვს — შეგვიძლია მოვიძიოთ.', en: 'No stock for this model right now — we can source one.', ru: 'Сейчас нет в наличии — можем найти.' },
  parts_add: { ka: 'დამატება', en: 'Add to request', ru: 'В заявку' },
  parts_added: { ka: 'დამატებულია', en: 'Added', ru: 'Добавлено' },
  parts_stock: { ka: 'მარაგში', en: 'in stock', ru: 'в наличии' },
  cond_exchange: { ka: 'გადაკრული, გაცვლით', en: 'Re-trimmed, exchange', ru: 'Перетянута, обмен' },
  cond_used: { ka: 'მეორადი ბაზა', en: 'Used core', ru: 'Б/у основа' },
  cond_new: { ka: 'ახალი', en: 'New', ru: 'Новая' },

  order_title: { ka: 'შეკვეთის განთავსება', en: 'Book your car in', ru: 'Записаться' },
  order_sub: { ka: 'ხუთი მოკლე ნაბიჯი. პასუხს მიიღებთ WhatsApp-ით იმავე დღეს.', en: 'Five short steps. You get a reply on WhatsApp the same day.', ru: 'Пять коротких шагов. Ответим в WhatsApp в тот же день.' },
  step_car: { ka: 'მანქანა', en: 'Car', ru: 'Авто' },
  step_work: { ka: 'სამუშაო', en: 'Work', ru: 'Работа' },
  step_photos: { ka: 'ფოტოები', en: 'Photos', ru: 'Фото' },
  step_date: { ka: 'თარიღი', en: 'Date', ru: 'Дата' },
  step_contact: { ka: 'კონტაქტი', en: 'Contact', ru: 'Контакт' },
  f_brand: { ka: 'მარკა', en: 'Make', ru: 'Марка' },
  f_model: { ka: 'მოდელი', en: 'Model', ru: 'Модель' },
  f_year: { ka: 'წელი', en: 'Year', ru: 'Год' },
  f_choose: { ka: 'აირჩიეთ', en: 'Choose', ru: 'Выберите' },
  f_services: { ka: 'რა გავაკეთოთ?', en: 'What should we do?', ru: 'Что нужно сделать?' },
  f_look: { ka: 'არჩეული ვარიანტი', en: 'Chosen look', ru: 'Выбранный вариант' },
  f_look_none: { ka: 'ვარიანტი არ არის არჩეული — შეგიძლიათ ზემოთ კონფიგურატორში აირჩიოთ.', en: 'No look chosen yet — you can pick one in the configurator above.', ru: 'Вариант не выбран — его можно подобрать в конфигураторе выше.' },
  f_parts: { ka: 'ნაწილები შეკვეთაში', en: 'Parts in this request', ru: 'Запчасти в заявке' },
  f_photos: { ka: 'ატვირთეთ 2–4 ფოტო: მთელი ტორპედო, დაზიანება და VIN.', en: 'Add 2–4 photos: the whole dashboard, the damage, and the VIN plate.', ru: 'Добавьте 2–4 фото: торпеда целиком, повреждения и VIN.' },
  f_photos_btn: { ka: 'ფოტოების არჩევა', en: 'Choose photos', ru: 'Выбрать фото' },
  f_date: { ka: 'როდის მოიყვანთ მანქანას?', en: 'When can you bring the car?', ru: 'Когда сможете пригнать авто?' },
  f_full: { ka: 'დაკავებულია', en: 'Full', ru: 'Занято' },
  f_name: { ka: 'სახელი', en: 'Name', ru: 'Имя' },
  f_phone: { ka: 'ტელეფონი', en: 'Phone', ru: 'Телефон' },
  f_channel: { ka: 'სად გიპასუხოთ?', en: 'Where should we reply?', ru: 'Где ответить?' },
  f_note: { ka: 'შენიშვნა (არასავალდებულო)', en: 'Note (optional)', ru: 'Комментарий (необязательно)' },
  f_back: { ka: 'უკან', en: 'Back', ru: 'Назад' },
  f_next: { ka: 'შემდეგი', en: 'Next', ru: 'Далее' },
  f_send: { ka: 'შეკვეთის გაგზავნა', en: 'Send request', ru: 'Отправить заявку' },
  f_need_car: { ka: 'აირჩიეთ მარკა და მოდელი.', en: 'Choose a make and model to continue.', ru: 'Выберите марку и модель.' },
  f_need_work: { ka: 'აირჩიეთ ერთი სამუშაო მაინც.', en: 'Choose at least one job to continue.', ru: 'Выберите хотя бы одну работу.' },
  f_need_contact: { ka: 'შეიყვანეთ სახელი და ტელეფონი.', en: 'Enter your name and phone number.', ru: 'Укажите имя и телефон.' },
  sent_title: { ka: 'შეკვეთა გაგზავნილია', en: 'Request sent', ru: 'Заявка отправлена' },
  sent_text: { ka: 'ნომერი', en: 'Reference', ru: 'Номер' },
  sent_wa: { ka: 'WhatsApp-ში გაგზავნა', en: 'Also send on WhatsApp', ru: 'Отправить в WhatsApp' },
  sent_again: { ka: 'ახალი შეკვეთა', en: 'Start another request', ru: 'Новая заявка' },
  estimate: { ka: 'სავარაუდო ფასი', en: 'Rough estimate', ru: 'Ориентировочно' },
  estimate_note: { ka: 'საბოლოო ფასს ფოტოების ნახვის შემდეგ გეტყვით.', en: 'Final price after we see your photos.', ru: 'Точная цена — после фото.' },

  svc_dashboard: { ka: 'ტორპედოს გადაკვრა', en: 'Dashboard re-trim', ru: 'Перетяжка торпедо' },
  svc_wheel: { ka: 'საჭის გადაკვრა', en: 'Steering wheel', ru: 'Перетяжка руля' },
  svc_doors: { ka: 'კარის პანელები', en: 'Door cards', ru: 'Карты дверей' },
  svc_console: { ka: 'ცენტრალური კონსოლი', en: 'Centre console & armrest', ru: 'Консоль и подлокотник' },
  svc_airbag: { ka: 'ეარბეგის ნაკერის აღდგენა', en: 'Airbag seam repair', ru: 'Восстановление шва подушки' },
  svc_part: { ka: 'ნაწილის ყიდვა', en: 'Buy a part', ru: 'Покупка запчасти' },

  footer_hours: { ka: 'ორშ–შაბ 10:00–19:00', en: 'Mon–Sat 10:00–19:00', ru: 'Пн–Сб 10:00–19:00' },
  footer_city: { ka: 'თბილისი, საქართველო', en: 'Tbilisi, Georgia', ru: 'Тбилиси, Грузия' },
  demo_banner: { ka: 'დემო ვერსია — მონაცემები სატესტოა', en: 'Demo — sample data only', ru: 'Демо — тестовые данные' },
} satisfies Record<string, Entry>

export type Key = keyof typeof dict

type LangState = { lang: Lang; setLang: (l: Lang) => void }
export const useLang = create<LangState>()(
  persist((set) => ({ lang: 'ka', setLang: (lang) => set({ lang }) }), { name: 'ai-lang' }),
)

export function useT() {
  const lang = useLang((s) => s.lang)
  return (k: Key) => dict[k][lang]
}
