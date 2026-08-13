<template>
    <div class="subscribe-line" data-testid="group-subscribe-form">
        <form class="d-flex flex-nowrap justify-content-end align-items-center gap-2" @submit.prevent="submit">
            <span class="subscribe-icon-wrap" data-testid="subscribe-icon-wrap" tabindex="0">
                <font-awesome-icon icon="envelope" class="text-muted subscribe-icon" data-testid="subscribe-icon" />
                <span class="subscribe-tooltip" role="tooltip" data-testid="subscribe-tooltip">
                    {{ $t("subscribeDescription") }}
                </span>
            </span>
            <input
                v-model="email"
                type="email"
                class="form-control form-control-sm"
                style="max-width: 180px"
                :placeholder="$t('Email')"
                required
                data-testid="subscribe-email-input"
            />
            <button
                class="btn btn-outline-secondary btn-sm text-nowrap"
                type="submit"
                :disabled="submitting"
                data-testid="subscribe-submit-button"
            >
                {{ $t("Subscribe") }}
            </button>
        </form>
        <div v-if="message" class="form-text mt-1 text-end" data-testid="subscribe-message">
            {{ message }}
        </div>
    </div>
</template>

<script>
import axios from "axios";

export default {
    props: {
        /** Id of the group being subscribed to */
        groupId: {
            type: [String, Number],
            required: true,
        },
    },
    data() {
        return {
            email: "",
            submitting: false,
            message: "",
        };
    },
    methods: {
        /**
         * Submit the subscribe form
         * @returns {Promise<void>}
         */
        async submit() {
            this.submitting = true;

            try {
                await axios.post(`/api/status-page/group/${this.groupId}/subscribe`, {
                    email: this.email,
                });
            } catch (error) {
                // Fall through - the message shown below is intentionally the
                // same regardless of outcome, matching the backend's response.
            } finally {
                this.submitting = false;
                this.email = "";
                this.message = this.$t("subscribeConfirmationSent");
            }
        },
    },
};
</script>

<style lang="scss" scoped>
.subscribe-icon-wrap {
    position: relative;
    display: inline-flex;
    align-items: center;
    outline: none;
}

.subscribe-icon {
    cursor: help;
    flex-shrink: 0;
}

.subscribe-tooltip {
    position: absolute;
    bottom: calc(100% + 8px);
    right: 0;
    width: max-content;
    max-width: 220px;
    background: rgba(17, 24, 39, 0.95);
    color: #fff;
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 0.75rem;
    line-height: 1.3;
    text-align: left;
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transition: opacity 0.15s ease;
    z-index: 20;

    &::after {
        content: "";
        position: absolute;
        top: 100%;
        right: 6px;
        border: 5px solid transparent;
        border-top-color: rgba(17, 24, 39, 0.95);
    }
}

.subscribe-icon-wrap:hover .subscribe-tooltip,
.subscribe-icon-wrap:focus-visible .subscribe-tooltip {
    opacity: 1;
    visibility: visible;
}
</style>
