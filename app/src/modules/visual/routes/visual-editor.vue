<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useHead } from '@unhead/vue';
import ModuleBar from '@/views/private/components/module-bar.vue';
import NotificationDialogs from '@/views/private/components/notification-dialogs.vue';
import NotificationsGroup from '@/views/private/components/notifications-group.vue';
import LivePreview from '@/views/private/components/live-preview.vue';
import EditingLayer from '../components/editing-layer.vue';
import { getUrlRoute } from '../utils/get-url-route';
import { sameOrigin } from '../utils/same-origin';
import type { NavigationData } from '../types';

const { dynamicUrl, invalidUrl } = defineProps<{
	urls: string[];
	dynamicUrl?: string;
	invalidUrl?: boolean;
}>();

const { t } = useI18n();
const router = useRouter();

useHead({ title: t('visual_editor') });

const moduleBarOpen = ref(true);
const showEditableElements = ref(false);

const { dynamicDisplay, onNavigation } = usePageInfo();

function usePageInfo() {
	const dynamicDisplay = ref<string>();

	return { dynamicDisplay, onNavigation };

	function onNavigation(data: NavigationData) {
		dynamicDisplay.value = data.title;
		router.replace(getUrlRoute(data.url));
	}
}

function onSelectUrl(newUrl: string, oldUrl: string) {
	const differentOrigin = newUrl !== oldUrl && !sameOrigin(newUrl, oldUrl);

	dynamicDisplay.value = undefined;

	if (invalidUrl) {
		router.push(getUrlRoute(newUrl));
	} else if (differentOrigin) {
		window.location.assign(router.resolve(getUrlRoute(newUrl)).href);
	} else {
		router.replace(getUrlRoute(newUrl));
	}
}
</script>

<template>
	<div class="module">
		<transition-expand x-axis>
			<module-bar v-if="moduleBarOpen" />
		</transition-expand>

		<live-preview
			:url="urls"
			:invalid-url
			:dynamic-url
			:dynamic-display
			:single-url-subdued="false"
			:header-expanded="moduleBarOpen"
			hide-refresh-button
			hide-popup-button
			centered
			@select-url="onSelectUrl"
		>
			<template #prepend-header>
				<v-button
					v-tooltip.bottom.end="t('toggle_navigation')"
					x-small
					rounded
					icon
					secondary
					@click="moduleBarOpen = !moduleBarOpen"
				>
					<v-icon small :name="moduleBarOpen ? 'left_panel_close' : 'left_panel_open'" outline />
				</v-button>

				<v-button
					v-tooltip.bottom.end="t('toggle_editable_elements')"
					x-small
					rounded
					icon
					:active="showEditableElements"
					secondary
					@click="showEditableElements = !showEditableElements"
				>
					<v-icon small name="edit" outline />
				</v-button>
			</template>

			<template #overlay="{ frameEl, frameSrc }">
				<editing-layer :frame-src :frame-el :show-editable-elements @navigation="onNavigation" />
			</template>
		</live-preview>

		<notification-dialogs />
		<notifications-group no-sidebar />
	</div>
</template>

<style scoped lang="scss">
.module {
	position: relative;
	display: flex;
	block-size: 100%;
	inline-size: 100%;
	overflow: hidden;
}

.live-preview {
	block-size: 100%;
	inline-size: 100%;
	min-inline-size: 0;
}

.spacer {
	flex: 1;
}
</style>
