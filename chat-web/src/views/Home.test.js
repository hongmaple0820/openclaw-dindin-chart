import { beforeEach, describe, expect, it, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import Home from './Home.vue';

const push = vi.fn();
const authState = {
  isLoggedIn: false
};

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push
  })
}));

vi.mock('@/stores/user', () => ({
  useUserStore: () => ({
    get isLoggedIn() {
      return authState.isLoggedIn;
    }
  })
}));

const mountHome = () => shallowMount(Home, {
  global: {
    stubs: {
      ElButton: {
        template: '<button @click="$emit(\'click\')"><slot /></button>'
      },
      ElIcon: true,
      ChatDotRound: true,
      Connection: true,
      UserFilled: true
    }
  }
});

describe('Home view', () => {
  beforeEach(() => {
    push.mockReset();
    authState.isLoggedIn = false;
  });

  it('shows guest entry actions and routes the primary CTA correctly', async () => {
    const wrapper = mountHome();
    const buttons = wrapper.findAll('button');

    expect(buttons).toHaveLength(2);

    await buttons[0].trigger('click');

    expect(push).toHaveBeenCalledWith('/register');
  });

  it('shows the collaboration entry for logged-in users', async () => {
    authState.isLoggedIn = true;
    const wrapper = mountHome();
    const buttons = wrapper.findAll('button');

    expect(buttons).toHaveLength(1);

    await buttons[0].trigger('click');

    expect(push).toHaveBeenCalledWith('/chat');
  });
});
