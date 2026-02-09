package com.bi1kbu.pluginschedule;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import run.halo.app.extension.SchemeManager;
import run.halo.app.plugin.PluginContext;

@ExtendWith(MockitoExtension.class)
class PluginSchedulePluginTest {

    @Mock
    PluginContext context;

    @Mock
    SchemeManager schemeManager;

    @InjectMocks
    PluginSchedulePlugin plugin;

    @Test
    void contextLoads() {
        plugin.start();
        plugin.stop();
    }
}
