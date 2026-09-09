
# import json
from django.test import TestCase
# from channels.testing import WebsocketCommunicator
# from .consumers import ChatConsumer

# class ChatTests(TestCase):
#     async def test_my_consumer(self):
#         communicator = WebsocketCommunicator(
#             ChatConsumer.as_asgi(),
#             "/testws/"
#         )
#         connected, _ = await communicator.connect()
#         assert connected

#         await communicator.send_to(
#             text_data=json.dumps({"message": "hello"})
#         )

#         response = await communicator.receive_from()
#         assert json.loads(response)["message"] == "hello"

#         await communicator.disconnect()

# chat/tests.py
"""
Channels tutorial Selenium suite (legacy room templates).

Opt-in only — normal `python manage.py test` / `python manage.py test chats`
skips these tests and never launches Chrome.

To run intentionally (requires Chrome/Chromium):

  TMF_RUN_CHANNELS_LIVE_TESTS=1 python manage.py test chats.tests.ChatTests

When enabled, ChatTests sets TMF_CHANNELS_LIVE_TEST=1 so the Daphne child
process loads chats.tests_live_* ASGI/URLConf. That swap never applies in
production unless that env flag is set.
"""
import os
import unittest

from channels.testing import ChannelsLiveServerTestCase
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.wait import WebDriverWait


@unittest.skipUnless(
    os.getenv("TMF_RUN_CHANNELS_LIVE_TESTS") == "1",
    "Set TMF_RUN_CHANNELS_LIVE_TESTS=1 to run Selenium Channels live tests "
    "(requires Chrome). Example: "
    "TMF_RUN_CHANNELS_LIVE_TESTS=1 python manage.py test chats.tests.ChatTests",
)
class ChatTests(ChannelsLiveServerTestCase):
    serve_static = True  # emulate StaticLiveServerTestCase

    @classmethod
    def setUpClass(cls):
        # Daphne runs in a child process; override_settings does not cross that boundary.
        # This env flag is read in config.settings only for the live-test child process.
        os.environ["TMF_CHANNELS_LIVE_TEST"] = "1"
        super().setUpClass()
        try:
            # NOTE: Requires a Chrome/Chromium binary; Selenium Manager resolves the driver.
            options = Options()
            options.add_argument("--headless=new")
            options.add_argument("--no-sandbox")
            options.add_argument("--disable-dev-shm-usage")
            cls.driver = webdriver.Chrome(options=options)
        except Exception:
            super().tearDownClass()
            os.environ.pop("TMF_CHANNELS_LIVE_TEST", None)
            raise

    @classmethod
    def tearDownClass(cls):
        try:
            cls.driver.quit()
            super().tearDownClass()
        finally:
            os.environ.pop("TMF_CHANNELS_LIVE_TEST", None)

    def test_when_chat_message_posted_then_seen_by_everyone_in_same_room(self):
        try:
            self._enter_chat_room("room_1")

            self._open_new_window()
            self._enter_chat_room("room_1")

            self._switch_to_window(0)
            self._post_message("hello")
            WebDriverWait(self.driver, 2).until(
                lambda _: "hello" in self._chat_log_value,
                "Message was not received by window 1 from window 1",
            )
            self._switch_to_window(1)
            WebDriverWait(self.driver, 2).until(
                lambda _: "hello" in self._chat_log_value,
                "Message was not received by window 2 from window 1",
            )
        finally:
            self._close_all_new_windows()

    def test_when_chat_message_posted_then_not_seen_by_anyone_in_different_room(self):
        try:
            self._enter_chat_room("room_1")

            self._open_new_window()
            self._enter_chat_room("room_2")

            self._switch_to_window(0)
            self._post_message("hello")
            WebDriverWait(self.driver, 2).until(
                lambda _: "hello" in self._chat_log_value,
                "Message was not received by window 1 from window 1",
            )

            self._switch_to_window(1)
            self._post_message("world")
            WebDriverWait(self.driver, 2).until(
                lambda _: "world" in self._chat_log_value,
                "Message was not received by window 2 from window 2",
            )
            self.assertTrue(
                "hello" not in self._chat_log_value,
                "Message was improperly received by window 2 from window 1",
            )
        finally:
            self._close_all_new_windows()

    # === Utility ===

    def _enter_chat_room(self, room_name):
        self.driver.get(self.live_server_url + "/chats/")
        ActionChains(self.driver).send_keys(room_name, Keys.ENTER).perform()
        WebDriverWait(self.driver, 2).until(
            lambda _: room_name in self.driver.current_url
        )

    def _open_new_window(self):
        self.driver.execute_script('window.open("about:blank", "_blank");')
        self._switch_to_window(-1)

    def _close_all_new_windows(self):
        while len(self.driver.window_handles) > 1:
            self._switch_to_window(-1)
            self.driver.execute_script("window.close();")
        if len(self.driver.window_handles) == 1:
            self._switch_to_window(0)

    def _switch_to_window(self, window_index):
        self.driver.switch_to.window(self.driver.window_handles[window_index])

    def _post_message(self, message):
        ActionChains(self.driver).send_keys(message, Keys.ENTER).perform()

    @property
    def _chat_log_value(self):
        return self.driver.find_element(
            by=By.CSS_SELECTOR, value="#chat-log"
        ).get_property("value")
    

    class ConversationTests(TestCase):
        def setUp():
            pass

        def convo_fail_without_inquiry(self):
            pass
