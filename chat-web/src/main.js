/**
 * 应用入口
 * @author 小琳
 * @date 2026-02-06
 */
import { createApp } from 'vue';
// 只导入实际使用的图标，而非全量导入
import {
  Plus, Loading, Setting, ChatDotRound, UserFilled, User, Refresh,
  Document, More, MagicStick, List, Delete, Connection, Clock,
  Link, Check, ArrowLeft, Tools, SwitchButton, Monitor, FolderOpened,
  Download, DataBoard, CopyDocument, View, Upload, Star, Menu,
  HomeFilled, Folder, Edit, Close, ChatLineSquare, Bell, ArrowDown,
  WarningFilled, Warning, UploadFilled, Search, QuestionFilled,
  PictureFilled, Picture, Paperclip, Mute, MoreFilled, Microphone,
  Lock, Grid, DataAnalysis, Cpu, Collection, ChatLineRound, Calendar,
  Box, ArrowRight, VideoPlay, VideoPause, Tickets
} from '@element-plus/icons-vue';

import App from './App.vue';
import router from './router';
import pinia from './stores';
import './styles/global.css';
import './styles/brand.css';
import './styles/mobile.css';

const app = createApp(App);

// 只注册实际使用的图标组件
const icons = {
  Plus, Loading, Setting, ChatDotRound, UserFilled, User, Refresh,
  Document, More, MagicStick, List, Delete, Connection, Clock,
  Link, Check, ArrowLeft, Tools, SwitchButton, Monitor, FolderOpened,
  Download, DataBoard, CopyDocument, View, Upload, Star, Menu,
  HomeFilled, Folder, Edit, Close, ChatLineSquare, Bell, ArrowDown,
  WarningFilled, Warning, UploadFilled, Search, QuestionFilled,
  PictureFilled, Picture, Paperclip, Mute, MoreFilled, Microphone,
  Lock, Grid, DataAnalysis, Cpu, Collection, ChatLineRound, Calendar,
  Box, ArrowRight, VideoPlay, VideoPause, Tickets
};

for (const [name, component] of Object.entries(icons)) {
  app.component(name, component);
}

app.use(pinia);
app.use(router);

// ElementPlus 组件通过 unplugin-vue-components 自动按需引入，无需全局注册

app.mount('#app');